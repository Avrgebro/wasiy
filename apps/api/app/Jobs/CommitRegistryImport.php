<?php

namespace App\Jobs;

use App\Data\RegistryImports\NormalizedRegistryRow;
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

        if (! $import->claimProcessing(ImportStatus::ReadyForReview, requireConfirmed: true)) {
            return;
        }

        try {
            // One transaction for the whole run: a failure on any row rolls
            // back every row, so an import is either fully Completed or
            // untouched-and-Failed — never half-committed.
            DB::transaction(function () use ($import, $activityLogger): void {
                $this->skipDuplicateRows($import);

                $results = $import->rows()
                    ->whereIn('status', [ImportRowStatus::Valid, ImportRowStatus::Warning])
                    ->orderBy('row_number')
                    ->get()
                    ->map(fn (RegistryImportRow $row): array => $this->commitRow($import, $row));

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
                        ...$import->activityMetadata(),
                        'created_unit_ids' => $this->uniqueIds($results->pluck('unit_ids')->flatten()->all()),
                        'created_resident_ids' => $this->uniqueIds($results->pluck('resident_ids')->flatten()->all()),
                        'created_unit_membership_ids' => $this->uniqueIds($results->pluck('unit_membership_ids')->flatten()->all()),
                    ],
                    location: $import->location,
                    actor: $import->requestedBy,
                    subjectType: RegistryImport::class,
                    subjectId: $import->id,
                );
            });
        } catch (Throwable $exception) {
            // The rollback reverted the database but not the in-memory
            // model; re-sync before stamping the failure.
            $import->refresh();
            $import->markFailed($exception->getMessage());

            $activityLogger->log(
                account: $import->account,
                eventType: ActivityEventType::ImportFailed,
                summary: 'Importacion CSV fallida.',
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
        $created = [
            'unit_ids' => [],
            'resident_ids' => [],
            'unit_membership_ids' => [],
        ];
        $normalized = NormalizedRegistryRow::fromArray($row->normalized_data);
        [$unit, $unitCreated] = $this->resolveUnit($import, $normalized);

        if ($unitCreated) {
            $created['unit_ids'][] = $unit->id;
        }

        if (! $normalized->isResidentRow()) {
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
            'resident_type' => $normalized->residentType,
            'status' => $normalized->membershipStatus,
            'is_primary_contact' => false,
            'started_at' => null,
            'ended_at' => null,
        ]);

        if ($normalized->isPrimaryContact) {
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
    }

    /**
     * @return array{0: Unit, 1: bool}
     */
    private function resolveUnit(RegistryImport $import, NormalizedRegistryRow $normalized): array
    {
        if ($normalized->existingUnitId !== null) {
            $unit = Unit::query()
                ->where('account_id', $import->account_id)
                ->where('location_id', $import->location_id)
                ->find($normalized->existingUnitId);

            if ($unit) {
                return [$unit, false];
            }
        }

        $unit = null;

        if ($normalized->unitNumber !== null) {
            $unit = Unit::query()
                ->where('account_id', $import->account_id)
                ->where('location_id', $import->location_id)
                ->matchingImportIdentity($normalized->unitNumber, $normalized->buildingName)
                ->first();
        }

        if ($unit) {
            return [$unit, false];
        }

        return [Unit::query()->create([
            'account_id' => $import->account_id,
            'location_id' => $import->location_id,
            'unit_number' => $normalized->unitNumber,
            'building_name' => $normalized->buildingName,
            'floor' => $normalized->floor,
            'status' => RegistryStatus::Active,
            'notes' => $normalized->unitNotes,
        ]), true];
    }

    /**
     * @return array{0: Resident, 1: bool}
     */
    private function resolveResident(RegistryImport $import, NormalizedRegistryRow $normalized): array
    {
        if ($normalized->existingResidentId !== null) {
            $resident = Resident::query()
                ->where('account_id', $import->account_id)
                ->find($normalized->existingResidentId);

            if ($resident) {
                return [$resident, false];
            }
        }

        if ($normalized->email !== null) {
            $resident = Resident::query()
                ->where('account_id', $import->account_id)
                ->matchingEmail($normalized->email)
                ->first();

            if ($resident) {
                return [$resident, false];
            }
        }

        return [Resident::query()->create([
            'account_id' => $import->account_id,
            'first_name' => $normalized->firstName,
            'last_name' => $normalized->lastName,
            'phone' => $normalized->phone,
            'email' => $normalized->email,
            'status' => RegistryStatus::Active,
        ]), true];
    }

    private function existingActiveMembership(Unit $unit, Resident $resident): ?UnitMembership
    {
        return UnitMembership::query()->activeFor($unit, $resident)->first();
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
