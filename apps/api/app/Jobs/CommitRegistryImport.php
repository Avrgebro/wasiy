<?php

namespace App\Jobs;

use App\Enums\ActivityEventType;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\RegistryStatus;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Services\ActivityLogger;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class CommitRegistryImport implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly RegistryImport $import,
    ) {}

    public function handle(?ActivityLogger $activityLogger = null): void
    {
        $activityLogger ??= app(ActivityLogger::class);

        $import = $this->import->fresh(['account', 'location', 'requestedBy']);

        if (! $import || $import->error_rows > 0) {
            return;
        }

        // Claim atomically: a conditional update guarantees only one worker
        // transitions the import into Processing.
        $claimed = RegistryImport::query()
            ->whereKey($import->id)
            ->where('status', ImportStatus::ReadyForReview)
            ->update([
                'status' => ImportStatus::Processing,
                'failed_at' => null,
                'failure_reason' => null,
            ]);

        if ($claimed !== 1) {
            return;
        }

        $import->refresh();

        $createdUnitIds = [];
        $createdResidentIds = [];
        $createdMembershipIds = [];

        try {
            $this->skipDuplicateRows($import);

            $import->rows()
                ->whereIn('status', [ImportRowStatus::Valid, ImportRowStatus::Warning])
                ->orderBy('row_number')
                ->each(function (RegistryImportRow $row) use ($import, &$createdUnitIds, &$createdResidentIds, &$createdMembershipIds): void {
                    $created = $this->commitRow($import, $row);

                    array_push($createdUnitIds, ...$created['unit_ids']);
                    array_push($createdResidentIds, ...$created['resident_ids']);
                    array_push($createdMembershipIds, ...$created['unit_membership_ids']);
                });

            $import->forceFill([
                'status' => ImportStatus::Completed,
                'completed_at' => now(),
                'failed_at' => null,
                'failure_reason' => null,
            ])->save();

            $activityLogger->log(
                account: $import->account,
                eventType: ActivityEventType::ImportCompleted,
                summary: 'Importacion CSV completada.',
                metadata: [
                    ...$this->activityMetadata($import),
                    'created_unit_ids' => $this->uniqueIds($createdUnitIds),
                    'created_resident_ids' => $this->uniqueIds($createdResidentIds),
                    'created_unit_membership_ids' => $this->uniqueIds($createdMembershipIds),
                ],
                location: $import->location,
                actor: $import->requestedBy,
                subjectType: RegistryImport::class,
                subjectId: $import->id,
            );
        } catch (Throwable $exception) {
            $import->forceFill([
                'status' => ImportStatus::Failed,
                'failed_at' => now(),
                'failure_reason' => $exception->getMessage(),
            ])->save();

            $activityLogger->log(
                account: $import->account,
                eventType: ActivityEventType::ImportFailed,
                summary: 'Importacion CSV fallida.',
                metadata: [
                    ...$this->activityMetadata($import),
                    'failure_reason' => $exception->getMessage(),
                ],
                location: $import->location,
                actor: $import->requestedBy,
                subjectType: RegistryImport::class,
                subjectId: $import->id,
            );
        }
    }

    private function skipDuplicateRows(RegistryImport $import): void
    {
        $import->rows()
            ->where('status', ImportRowStatus::Duplicate)
            ->update(['status' => ImportRowStatus::Skipped]);
    }

    /**
     * @return array{unit_ids: array<int, string>, resident_ids: array<int, string>, unit_membership_ids: array<int, string>}
     */
    private function commitRow(RegistryImport $import, RegistryImportRow $row): array
    {
        return DB::transaction(function () use ($import, $row): array {
            $created = [
                'unit_ids' => [],
                'resident_ids' => [],
                'unit_membership_ids' => [],
            ];
            $normalized = $row->normalized_data;
            [$unit, $unitCreated] = $this->resolveUnit($import, $normalized);

            if ($unitCreated) {
                $created['unit_ids'][] = $unit->id;
            }

            if (! $this->isResidentRow($normalized)) {
                $row->forceFill([
                    'status' => ImportRowStatus::Imported,
                    'committed_unit_id' => $unit->id,
                ])->save();

                return $created;
            }

            [$resident, $residentCreated] = $this->resolveResident($import, $normalized);

            if ($residentCreated) {
                $created['resident_ids'][] = $resident->id;
            }

            $membership = $this->existingActiveMembership($unit, $resident);

            if ($membership) {
                $row->forceFill([
                    'status' => ImportRowStatus::Skipped,
                    'committed_unit_id' => $unit->id,
                    'committed_resident_id' => $resident->id,
                    'committed_unit_membership_id' => $membership->id,
                ])->save();

                return $created;
            }

            $membership = UnitMembership::query()->create([
                'account_id' => $import->account_id,
                'location_id' => $import->location_id,
                'unit_id' => $unit->id,
                'resident_id' => $resident->id,
                'resident_type' => $normalized['resident_type'],
                'status' => $normalized['membership_status'] ?? RegistryStatus::Active,
                'is_primary_contact' => false,
                'started_at' => null,
                'ended_at' => null,
            ]);

            if (($normalized['is_primary_contact'] ?? false) === true) {
                $membership->markAsPrimaryContact();
                $membership->refresh();
            }

            $created['unit_membership_ids'][] = $membership->id;

            $row->forceFill([
                'status' => ImportRowStatus::Imported,
                'committed_unit_id' => $unit->id,
                'committed_resident_id' => $resident->id,
                'committed_unit_membership_id' => $membership->id,
            ])->save();

            return $created;
        });
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @return array{0: Unit, 1: bool}
     */
    private function resolveUnit(RegistryImport $import, array $normalized): array
    {
        $existingUnitId = $normalized['existing_unit_id'] ?? null;

        if (is_string($existingUnitId)) {
            $unit = Unit::query()
                ->where('account_id', $import->account_id)
                ->where('location_id', $import->location_id)
                ->find($existingUnitId);

            if ($unit) {
                return [$unit, false];
            }
        }

        $unitNumber = $normalized['unit_number'] ?? null;
        $buildingName = $normalized['building_name'] ?? null;

        $unit = null;

        if (is_string($unitNumber)) {
            $unit = Unit::query()
                ->where('account_id', $import->account_id)
                ->where('location_id', $import->location_id)
                ->whereRaw('LOWER(unit_number) = ?', [Str::lower($unitNumber)])
                ->whereRaw("LOWER(COALESCE(building_name, '')) = ?", [Str::lower((string) $buildingName)])
                ->first();
        }

        if ($unit) {
            return [$unit, false];
        }

        return [Unit::query()->create([
            'account_id' => $import->account_id,
            'location_id' => $import->location_id,
            'unit_number' => $unitNumber,
            'building_name' => $buildingName,
            'floor' => $normalized['floor'] ?? null,
            'status' => RegistryStatus::Active,
            'notes' => $normalized['unit_notes'] ?? null,
        ]), true];
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @return array{0: Resident, 1: bool}
     */
    private function resolveResident(RegistryImport $import, array $normalized): array
    {
        $existingResidentId = $normalized['existing_resident_id'] ?? null;

        if (is_string($existingResidentId)) {
            $resident = Resident::query()
                ->where('account_id', $import->account_id)
                ->find($existingResidentId);

            if ($resident) {
                return [$resident, false];
            }
        }

        $email = $normalized['email'] ?? null;

        if (is_string($email)) {
            $resident = Resident::query()
                ->where('account_id', $import->account_id)
                ->whereRaw('LOWER(email) = ?', [Str::lower($email)])
                ->first();

            if ($resident) {
                return [$resident, false];
            }
        }

        return [Resident::query()->create([
            'account_id' => $import->account_id,
            'first_name' => $normalized['first_name'],
            'last_name' => $normalized['last_name'],
            'phone' => $normalized['phone'] ?? null,
            'email' => $email,
            'status' => RegistryStatus::Active,
        ]), true];
    }

    private function existingActiveMembership(Unit $unit, Resident $resident): ?UnitMembership
    {
        return UnitMembership::query()
            ->where('account_id', $unit->account_id)
            ->where('location_id', $unit->location_id)
            ->where('unit_id', $unit->id)
            ->where('resident_id', $resident->id)
            ->where('status', RegistryStatus::Active)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $normalized
     */
    private function isResidentRow(array $normalized): bool
    {
        return ($normalized['first_name'] ?? null) !== null
            || ($normalized['last_name'] ?? null) !== null
            || ($normalized['phone'] ?? null) !== null
            || ($normalized['email'] ?? null) !== null
            || ($normalized['resident_type'] ?? null) !== null
            || ($normalized['is_primary_contact'] ?? false) === true;
    }

    /**
     * @return array<string, mixed>
     */
    private function activityMetadata(RegistryImport $import): array
    {
        return [
            'import_id' => $import->id,
            'import_type' => $import->import_type->value,
            'filename' => $import->original_filename,
            'location_id' => $import->location_id,
            'total_rows' => $import->total_rows,
            'valid_rows' => $import->valid_rows,
            'error_rows' => $import->error_rows,
            'duplicate_rows' => $import->duplicate_rows,
            'warning_rows' => $import->warning_rows,
            'actor_user_id' => $import->requested_by_user_id,
        ];
    }

    /**
     * @param  array<int, string>  $ids
     * @return array<int, string>
     */
    private function uniqueIds(array $ids): array
    {
        return array_values(array_unique($ids));
    }
}
