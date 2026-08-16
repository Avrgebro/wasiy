<?php

namespace App\Data\RegistryImports;

use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use Illuminate\Support\Str;

/**
 * The typed shape of one import row after validation. This is the single
 * owner of what counts as a "resident row" and of the unit identity keys the
 * whole pipeline (validator, duplicate detector, commit job) must agree on.
 */
class NormalizedRegistryRow
{
    public function __construct(
        public readonly ?string $unitNumber,
        public readonly ?string $buildingName,
        public readonly ?string $floor,
        public readonly ?string $unitNotes,
        public readonly ?string $firstName,
        public readonly ?string $lastName,
        public readonly ?string $phone,
        public readonly ?string $email,
        public readonly ?ResidentType $residentType,
        public readonly RegistryStatus $membershipStatus,
        public readonly bool $isPrimaryContact,
        public ?string $existingUnitId = null,
        public ?string $existingResidentId = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $residentType = $data['resident_type'] ?? null;
        $membershipStatus = $data['membership_status'] ?? null;

        return new self(
            unitNumber: self::stringOrNull($data['unit_number'] ?? null),
            buildingName: self::stringOrNull($data['building_name'] ?? null),
            floor: self::stringOrNull($data['floor'] ?? null),
            unitNotes: self::stringOrNull($data['unit_notes'] ?? null),
            firstName: self::stringOrNull($data['first_name'] ?? null),
            lastName: self::stringOrNull($data['last_name'] ?? null),
            phone: self::stringOrNull($data['phone'] ?? null),
            email: self::stringOrNull($data['email'] ?? null),
            residentType: is_string($residentType) ? ResidentType::tryFrom($residentType) : null,
            membershipStatus: (is_string($membershipStatus) ? RegistryStatus::tryFrom($membershipStatus) : null) ?? RegistryStatus::Active,
            isPrimaryContact: ($data['is_primary_contact'] ?? false) === true,
            existingUnitId: self::stringOrNull($data['existing_unit_id'] ?? null),
            existingResidentId: self::stringOrNull($data['existing_resident_id'] ?? null),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $data = [
            'unit_number' => $this->unitNumber,
            'building_name' => $this->buildingName,
            'floor' => $this->floor,
            'unit_notes' => $this->unitNotes,
            'first_name' => $this->firstName,
            'last_name' => $this->lastName,
            'phone' => $this->phone,
            'email' => $this->email,
            'resident_type' => $this->residentType?->value,
            'membership_status' => $this->membershipStatus->value,
            'is_primary_contact' => $this->isPrimaryContact,
        ];

        if ($this->existingUnitId !== null) {
            $data['existing_unit_id'] = $this->existingUnitId;
        }

        if ($this->existingResidentId !== null) {
            $data['existing_resident_id'] = $this->existingResidentId;
        }

        return $data;
    }

    public function isResidentRow(): bool
    {
        return $this->firstName !== null
            || $this->lastName !== null
            || $this->phone !== null
            || $this->email !== null
            || $this->residentType !== null
            || $this->isPrimaryContact;
    }

    public function normalizedEmail(): ?string
    {
        return $this->email === null ? null : Str::lower($this->email);
    }

    /**
     * Human-identity key used for in-file duplicate detection.
     */
    public function unitKey(): string
    {
        return Str::of((string) $this->buildingName)
            ->ascii()
            ->lower()
            ->trim()
            ->append(':')
            ->append(Str::of((string) $this->unitNumber)->ascii()->lower()->trim())
            ->toString();
    }

    /**
     * Database-identity key; mirrors Unit::scopeMatchingImportIdentity and
     * Unit::importMatchKey. Deliberately lowercases without trimming: the
     * CSV parser already trims cell values, which is what keeps this key
     * coherent with the trim-happy unitKey() above.
     */
    public function unitMatchKey(): string
    {
        return Str::lower((string) $this->unitNumber).'|'.Str::lower((string) $this->buildingName);
    }

    private static function stringOrNull(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }
}
