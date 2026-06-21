<?php

namespace App\Services\RegistryImports;

use App\Data\RegistryImports\RegistryImportRowPreview;
use App\Enums\ImportRowStatus;
use App\Enums\RegistryStatus;
use App\Models\Location;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use Illuminate\Support\Str;

class RegistryImportDuplicateDetector
{
    /**
     * @param  array<int, RegistryImportRowPreview>  $previews
     * @return array<int, RegistryImportRowPreview>
     */
    public function detect(Location $location, array $previews): array
    {
        $seenUnitOnlyRows = [];
        $seenResidentMembershipRows = [];

        foreach ($previews as $preview) {
            if ($preview->status === ImportRowStatus::Error) {
                continue;
            }

            $unit = $this->existingUnit($location, $preview);
            $resident = $this->existingResident($location, $preview);

            if ($unit) {
                $preview->normalizedData['existing_unit_id'] = $unit->id;
                $preview->addWarning('La unidad existente sera reutilizada.');
            }

            if ($resident) {
                $preview->normalizedData['existing_resident_id'] = $resident->id;
                $preview->addWarning('El residente existente sera reutilizado.');
            }

            $isResidentRow = $this->isResidentRow($preview);
            $unitKey = $this->unitKey($preview);

            if (! $isResidentRow) {
                if (isset($seenUnitOnlyRows[$unitKey])) {
                    $preview->markDuplicate("unit-row:{$unitKey}");
                } else {
                    $seenUnitOnlyRows[$unitKey] = true;
                }

                continue;
            }

            if ($unit && $resident && $this->activeMembershipExists($unit, $resident)) {
                $preview->markDuplicate("membership:{$unit->id}:{$resident->id}");

                continue;
            }

            $email = $this->normalizedEmail($preview);
            $membershipKey = "{$unitKey}:{$email}";

            if ($email !== null && isset($seenResidentMembershipRows[$membershipKey])) {
                $preview->markDuplicate("resident-row:{$membershipKey}");
            } else {
                $seenResidentMembershipRows[$membershipKey] = true;
            }
        }

        return $previews;
    }

    private function existingUnit(Location $location, RegistryImportRowPreview $preview): ?Unit
    {
        return Unit::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->whereRaw('LOWER(unit_number) = ?', [Str::lower((string) $preview->normalizedData['unit_number'])])
            ->whereRaw("LOWER(COALESCE(building_name, '')) = ?", [Str::lower((string) ($preview->normalizedData['building_name'] ?? ''))])
            ->first();
    }

    private function existingResident(Location $location, RegistryImportRowPreview $preview): ?Resident
    {
        $email = $this->normalizedEmail($preview);

        if ($email === null) {
            return null;
        }

        return Resident::query()
            ->where('account_id', $location->account_id)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();
    }

    private function activeMembershipExists(Unit $unit, Resident $resident): bool
    {
        return UnitMembership::query()
            ->where('account_id', $unit->account_id)
            ->where('location_id', $unit->location_id)
            ->where('unit_id', $unit->id)
            ->where('resident_id', $resident->id)
            ->where('status', RegistryStatus::Active)
            ->exists();
    }

    private function isResidentRow(RegistryImportRowPreview $preview): bool
    {
        return $preview->normalizedData['first_name'] !== null
            || $preview->normalizedData['last_name'] !== null
            || $preview->normalizedData['phone'] !== null
            || $preview->normalizedData['email'] !== null
            || $preview->normalizedData['resident_type'] !== null
            || $preview->normalizedData['is_primary_contact'] === true;
    }

    private function normalizedEmail(RegistryImportRowPreview $preview): ?string
    {
        $email = $preview->normalizedData['email'] ?? null;

        return is_string($email) ? Str::lower($email) : null;
    }

    private function unitKey(RegistryImportRowPreview $preview): string
    {
        return Str::of((string) ($preview->normalizedData['building_name'] ?? ''))
            ->ascii()
            ->lower()
            ->trim()
            ->append(':')
            ->append(Str::of((string) $preview->normalizedData['unit_number'])->ascii()->lower()->trim())
            ->toString();
    }
}
