<?php

namespace App\Jobs;

use App\Data\RegistryImports\RegistryImportRowPreview;
use App\Enums\ActivityEventType;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Services\ActivityLogger;
use App\Services\RegistryImports\RegistryCsvParser;
use App\Services\RegistryImports\RegistryImportDuplicateDetector;
use App\Services\RegistryImports\RegistryImportValidator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class ValidateRegistryImport implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly RegistryImport $import,
    ) {}

    public function handle(
        ?RegistryCsvParser $parser = null,
        ?RegistryImportValidator $validator = null,
        ?RegistryImportDuplicateDetector $duplicateDetector = null,
        ?ActivityLogger $activityLogger = null,
    ): void {
        $parser ??= app(RegistryCsvParser::class);
        $validator ??= app(RegistryImportValidator::class);
        $duplicateDetector ??= app(RegistryImportDuplicateDetector::class);
        $activityLogger ??= app(ActivityLogger::class);

        $import = $this->import->fresh(['account', 'location', 'requestedBy']);

        if (! $import) {
            return;
        }

        // Claim atomically: a conditional update guarantees only one worker
        // transitions the import into Processing.
        $claimed = RegistryImport::query()
            ->whereKey($import->id)
            ->where('status', ImportStatus::Pending)
            ->update([
                'status' => ImportStatus::Processing,
                'failed_at' => null,
                'failure_reason' => null,
            ]);

        if ($claimed !== 1) {
            return;
        }

        $import->refresh();

        try {
            if ($import->disk === null || $import->path === null || ! Storage::disk($import->disk)->exists($import->path)) {
                throw new RuntimeException('No se pudo leer el archivo CSV almacenado.');
            }

            $contents = Storage::disk($import->disk)->get($import->path);
            $parsedRows = $parser->parse($contents);
            $previews = $duplicateDetector->detect(
                $import->location,
                $validator->validate($parsedRows),
            );

            DB::transaction(function () use ($import, $previews): void {
                $import->rows()->delete();

                foreach ($previews as $preview) {
                    $this->persistPreviewRow($import, $preview);
                }

                $counts = $this->statusCounts($previews);

                $import->forceFill([
                    'status' => ImportStatus::ReadyForReview,
                    'total_rows' => count($previews),
                    'valid_rows' => $counts[ImportRowStatus::Valid->value],
                    'error_rows' => $counts[ImportRowStatus::Error->value],
                    'duplicate_rows' => $counts[ImportRowStatus::Duplicate->value],
                    'warning_rows' => $counts[ImportRowStatus::Warning->value],
                    'failed_at' => null,
                    'failure_reason' => null,
                ])->save();
            });
        } catch (Throwable $exception) {
            $import->forceFill([
                'status' => ImportStatus::Failed,
                'failed_at' => now(),
                'failure_reason' => $exception->getMessage(),
            ])->save();

            $activityLogger->log(
                account: $import->account,
                eventType: ActivityEventType::ImportValidationFailed,
                summary: 'Validacion de importacion CSV fallida.',
                metadata: [
                    ...$import->activityMetadata(),
                    'failure_reason' => $exception->getMessage(),
                ],
                location: $import->location,
                actor: $import->requestedBy,
                subjectType: RegistryImport::class,
                subjectId: $import->id,
            );
        }
    }

    private function persistPreviewRow(RegistryImport $import, RegistryImportRowPreview $preview): void
    {
        RegistryImportRow::query()->create([
            'registry_import_id' => $import->id,
            'account_id' => $import->account_id,
            'location_id' => $import->location_id,
            'row_number' => $preview->rowNumber,
            'status' => $preview->status,
            'raw_data' => $preview->rawData,
            'normalized_data' => $preview->normalizedData->toArray(),
            'errors' => $preview->errors,
            'warnings' => $preview->warnings,
            'duplicate_key' => $preview->duplicateKey,
        ]);
    }

    /**
     * @param  array<int, RegistryImportRowPreview>  $previews
     * @return array<string, int>
     */
    private function statusCounts(array $previews): array
    {
        $counts = collect($previews)->countBy(fn (RegistryImportRowPreview $preview): string => $preview->status->value);

        return [
            ImportRowStatus::Valid->value => $counts->get(ImportRowStatus::Valid->value, 0),
            ImportRowStatus::Error->value => $counts->get(ImportRowStatus::Error->value, 0),
            ImportRowStatus::Duplicate->value => $counts->get(ImportRowStatus::Duplicate->value, 0),
            ImportRowStatus::Warning->value => $counts->get(ImportRowStatus::Warning->value, 0),
        ];
    }
}
