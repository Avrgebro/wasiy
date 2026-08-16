<?php

namespace App\Services\RegistryImports;

use App\Data\RegistryImports\NormalizedRegistryRow;
use App\Data\RegistryImports\ParsedRegistryImportRow;
use App\Data\RegistryImports\RegistryImportRowPreview;
use App\Enums\ImportRowStatus;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use Illuminate\Support\Str;

class RegistryImportValidator
{
    /**
     * @param  array<int, ParsedRegistryImportRow>  $rows
     * @return array<int, RegistryImportRowPreview>
     */
    public function validate(array $rows): array
    {
        $previews = array_map(fn (ParsedRegistryImportRow $row): RegistryImportRowPreview => $this->validateRow($row), $rows);

        $this->validateImportedPrimaryContacts($previews);

        return $previews;
    }

    private function validateRow(ParsedRegistryImportRow $row): RegistryImportRowPreview
    {
        $raw = $row->normalizedData;

        [$residentType, $residentTypeInvalid] = $this->normalizeResidentType($raw['resident_type']);
        [$membershipStatus, $membershipStatusInvalid] = $this->normalizeMembershipStatus($raw['membership_status']);
        [$isPrimaryContact, $isPrimaryContactInvalid] = $this->normalizeBoolean($raw['is_primary_contact']);

        $preview = new RegistryImportRowPreview(
            rowNumber: $row->rowNumber,
            rawData: $row->rawData,
            normalizedData: new NormalizedRegistryRow(
                unitNumber: $raw['unit_number'],
                buildingName: $raw['building_name'],
                floor: $raw['floor'],
                unitNotes: $raw['unit_notes'],
                firstName: $raw['first_name'],
                lastName: $raw['last_name'],
                phone: $raw['phone'],
                email: $raw['email'],
                residentType: $residentType,
                membershipStatus: $membershipStatus,
                isPrimaryContact: $isPrimaryContact,
            ),
        );
        $normalized = $preview->normalizedData;

        if ($normalized->unitNumber === null) {
            $preview->addError('El campo unidad es obligatorio.');
        }

        foreach (['unitNumber' => 'unidad', 'buildingName' => 'edificio', 'floor' => 'piso', 'unitNotes' => 'notas de unidad'] as $property => $label) {
            $this->validateMaxLength($preview, $normalized->{$property}, $label);
        }

        // Unrecognized values fail loudly on every row — a unit-only row
        // carrying garbage in these columns must not import clean.
        if ($membershipStatusInvalid) {
            $preview->addError('El estado de membresia no es valido.');
        }

        if ($isPrimaryContactInvalid) {
            $preview->addError('El valor de contacto principal no es valido.');
        }

        // Presence is judged on the raw input, not the typed values: an
        // unrecognized resident type still marks the row as a resident row so
        // it fails loudly instead of silently importing as unit-only.
        $hasResidentData = $normalized->firstName !== null
            || $normalized->lastName !== null
            || $normalized->phone !== null
            || $normalized->email !== null
            || $raw['resident_type'] !== null
            || $normalized->isPrimaryContact;

        if (! $hasResidentData) {
            return $preview;
        }

        foreach (['firstName' => 'nombres', 'lastName' => 'apellidos'] as $property => $label) {
            if ($normalized->{$property} === null) {
                $preview->addError("El campo {$label} es obligatorio para filas de residente.");
            }
        }

        foreach (['firstName' => 'nombres', 'lastName' => 'apellidos', 'phone' => 'telefono', 'email' => 'email'] as $property => $label) {
            $this->validateMaxLength($preview, $normalized->{$property}, $label);
        }

        if ($normalized->email !== null && filter_var($normalized->email, FILTER_VALIDATE_EMAIL) === false) {
            $preview->addError('El correo electronico no tiene un formato valido.');
        }

        if ($raw['resident_type'] === null) {
            $preview->addError('El tipo de residente es obligatorio para filas de residente.');
        } elseif ($residentTypeInvalid) {
            $preview->addError('El tipo de residente no es valido.');
        }

        // A primary contact on an inactive membership is contradictory:
        // makeActivePrimaryContact() would silently reactivate it on commit.
        if ($normalized->isPrimaryContact && $normalized->membershipStatus === RegistryStatus::Inactive) {
            $preview->addError('El contacto principal no puede tener una membresia inactiva.');
        }

        return $preview;
    }

    private function validateMaxLength(RegistryImportRowPreview $preview, ?string $value, string $label): void
    {
        if (is_string($value) && mb_strlen($value) > 255) {
            $preview->addError("El campo {$label} no puede superar 255 caracteres.");
        }
    }

    /**
     * @return array{0: ?ResidentType, 1: bool} typed value + whether the input was unrecognized
     */
    private function normalizeResidentType(?string $value): array
    {
        if ($value === null) {
            return [null, false];
        }

        $type = match ($this->normalizeToken($value)) {
            'owner', 'propietario', 'propietaria', 'dueno', 'duena' => ResidentType::Owner,
            'tenant', 'inquilino', 'inquilina', 'arrendatario', 'arrendataria' => ResidentType::Tenant,
            'occupant', 'ocupante' => ResidentType::Occupant,
            'guest_resident', 'residente_invitado', 'residente_invitada', 'invitado', 'invitada' => ResidentType::GuestResident,
            default => null,
        };

        return [$type, $type === null];
    }

    /**
     * @return array{0: RegistryStatus, 1: bool} typed value + whether the input was unrecognized
     */
    private function normalizeMembershipStatus(?string $value): array
    {
        if ($value === null) {
            return [RegistryStatus::Active, false];
        }

        $status = match ($this->normalizeToken($value)) {
            'active', 'activo', 'activa' => RegistryStatus::Active,
            'inactive', 'inactivo', 'inactiva' => RegistryStatus::Inactive,
            default => null,
        };

        return [$status ?? RegistryStatus::Active, $status === null];
    }

    /**
     * @return array{0: bool, 1: bool} typed value + whether the input was unrecognized
     */
    private function normalizeBoolean(?string $value): array
    {
        if ($value === null) {
            return [false, false];
        }

        $bool = match ($this->normalizeToken($value)) {
            'si', 's', 'true', '1', 'yes' => true,
            'no', 'n', 'false', '0' => false,
            default => null,
        };

        return [$bool ?? false, $bool === null];
    }

    private function normalizeToken(string $value): string
    {
        return Str::of($value)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->toString();
    }

    /**
     * @param  array<int, RegistryImportRowPreview>  $previews
     */
    private function validateImportedPrimaryContacts(array $previews): void
    {
        $primaryContactsByUnit = [];

        foreach ($previews as $preview) {
            if (! $preview->normalizedData->isPrimaryContact || $preview->status === ImportRowStatus::Error) {
                continue;
            }

            $primaryContactsByUnit[$preview->normalizedData->unitKey()][] = $preview;
        }

        foreach ($primaryContactsByUnit as $unitPreviews) {
            if (count($unitPreviews) < 2) {
                continue;
            }

            foreach ($unitPreviews as $preview) {
                $preview->addError('Solo puede haber un contacto principal importado por unidad.');
            }
        }
    }
}
