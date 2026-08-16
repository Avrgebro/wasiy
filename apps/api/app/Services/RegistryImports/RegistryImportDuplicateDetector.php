<?php

namespace App\Services\RegistryImports;

use App\Data\RegistryImports\RegistryImportRowPreview;
use App\Enums\ImportRowStatus;
use App\Enums\RegistryStatus;
use App\Models\Location;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RegistryImportDuplicateDetector
{
    /**
     * @param  array<int, RegistryImportRowPreview>  $previews
     * @return array<int, RegistryImportRowPreview>
     */
    public function detect(Location $location, array $previews): array
    {
        $candidates = array_filter(
            $previews,
            fn (RegistryImportRowPreview $preview): bool => $preview->status !== ImportRowStatus::Error,
        );

        // Three batched lookups replace up to three queries per row.
        $unitsByKey = $this->preloadUnits($location, $candidates);
        $residentsByEmail = $this->preloadResidents($location, $candidates);
        $activeMembershipPairs = $this->preloadActiveMembershipPairs($location, $candidates, $unitsByKey, $residentsByEmail);

        $seenUnitOnlyRows = [];
        $seenResidentMembershipRows = [];

        foreach ($candidates as $preview) {
            $row = $preview->normalizedData;
            $unit = $unitsByKey[$row->unitMatchKey()] ?? null;
            $email = $row->normalizedEmail();
            $resident = $email !== null ? ($residentsByEmail[$email] ?? null) : null;

            if ($unit) {
                $row->existingUnitId = $unit->id;
                $preview->addWarning('La unidad existente sera reutilizada.');
            }

            if ($resident) {
                $row->existingResidentId = $resident->id;
                $preview->addWarning('El residente existente sera reutilizado.');
            }

            $isResidentRow = $row->isResidentRow();
            $unitKey = $row->unitKey();

            if (! $isResidentRow) {
                if (isset($seenUnitOnlyRows[$unitKey])) {
                    $preview->markDuplicate("unit-row:{$unitKey}");
                } else {
                    $seenUnitOnlyRows[$unitKey] = true;
                }

                continue;
            }

            if ($unit && $resident && isset($activeMembershipPairs["{$unit->id}:{$resident->id}"])) {
                $preview->markDuplicate("membership:{$unit->id}:{$resident->id}");

                continue;
            }

            // Email-less resident rows are never in-file duplicates: without
            // an email there is no reliable identity to match on, so each
            // such row commits as its own resident.
            if ($email !== null) {
                $membershipKey = "{$unitKey}:{$email}";

                if (isset($seenResidentMembershipRows[$membershipKey])) {
                    $preview->markDuplicate("resident-row:{$membershipKey}");
                } else {
                    $seenResidentMembershipRows[$membershipKey] = true;
                }
            }
        }

        return $previews;
    }

    /**
     * @param  array<int, RegistryImportRowPreview>  $previews
     * @return array<string, Unit>
     */
    private function preloadUnits(Location $location, array $previews): array
    {
        $unitNumbers = collect($previews)
            ->map(fn (RegistryImportRowPreview $preview): string => Str::lower((string) $preview->normalizedData->unitNumber))
            ->unique()
            ->values();

        if ($unitNumbers->isEmpty()) {
            return [];
        }

        return Unit::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->whereIn(DB::raw('LOWER(unit_number)'), $unitNumbers)
            ->get()
            ->reduce(function (array $map, Unit $unit): array {
                $map[$unit->importMatchKey()] ??= $unit;

                return $map;
            }, []);
    }

    /**
     * @param  array<int, RegistryImportRowPreview>  $previews
     * @return array<string, Resident>
     */
    private function preloadResidents(Location $location, array $previews): array
    {
        $emails = collect($previews)
            ->map(fn (RegistryImportRowPreview $preview): ?string => $preview->normalizedData->normalizedEmail())
            ->filter()
            ->unique()
            ->values();

        if ($emails->isEmpty()) {
            return [];
        }

        return Resident::query()
            ->where('account_id', $location->account_id)
            ->whereIn(DB::raw('LOWER(email)'), $emails)
            ->get()
            ->reduce(function (array $map, Resident $resident): array {
                $map[Str::lower((string) $resident->email)] ??= $resident;

                return $map;
            }, []);
    }

    /**
     * Set of "unit_id:resident_id" pairs with an active membership, limited
     * to the units and residents the previews actually matched.
     *
     * @param  array<int, RegistryImportRowPreview>  $previews
     * @param  array<string, Unit>  $unitsByKey
     * @param  array<string, Resident>  $residentsByEmail
     * @return array<string, true>
     */
    private function preloadActiveMembershipPairs(Location $location, array $previews, array $unitsByKey, array $residentsByEmail): array
    {
        $unitIds = [];
        $residentIds = [];

        foreach ($previews as $preview) {
            $unit = $unitsByKey[$preview->normalizedData->unitMatchKey()] ?? null;
            $email = $preview->normalizedData->normalizedEmail();
            $resident = $email !== null ? ($residentsByEmail[$email] ?? null) : null;

            if ($unit && $resident) {
                $unitIds[$unit->id] = true;
                $residentIds[$resident->id] = true;
            }
        }

        if ($unitIds === [] || $residentIds === []) {
            return [];
        }

        return UnitMembership::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->where('status', RegistryStatus::Active)
            ->whereIn('unit_id', array_keys($unitIds))
            ->whereIn('resident_id', array_keys($residentIds))
            ->get(['unit_id', 'resident_id'])
            ->reduce(function (array $pairs, UnitMembership $membership): array {
                $pairs["{$membership->unit_id}:{$membership->resident_id}"] = true;

                return $pairs;
            }, []);
    }
}
