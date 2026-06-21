<?php

namespace App\Services\RegistryImports;

use App\Data\RegistryImports\ParsedRegistryImportRow;
use App\Data\RegistryImports\RegistryImportRowPreview;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Location;
use Illuminate\Support\Str;

class RegistryImportValidator
{
    /**
     * @param  array<int, ParsedRegistryImportRow>  $rows
     * @return array<int, RegistryImportRowPreview>
     */
    public function validate(Location $location, array $rows): array
    {
        $previews = array_map(fn (ParsedRegistryImportRow $row): RegistryImportRowPreview => $this->validateRow($row), $rows);

        $this->validateImportedPrimaryContacts($previews);

        return $previews;
    }

    private function validateRow(ParsedRegistryImportRow $row): RegistryImportRowPreview
    {
        $normalized = $row->normalizedData;
        $normalized['resident_type'] = $this->normalizeResidentType($normalized['resident_type']);
        $normalized['membership_status'] = $this->normalizeMembershipStatus($normalized['membership_status']);
        $normalized['is_primary_contact'] = $this->normalizeBoolean($normalized['is_primary_contact']);

        $preview = new RegistryImportRowPreview(
            rowNumber: $row->rowNumber,
            rawData: $row->rawData,
            normalizedData: $normalized,
        );

        if ($normalized['unit_number'] === null) {
            $preview->addError('El campo unidad es obligatorio.');
        }

        foreach (['unit_number' => 'unidad', 'building_name' => 'edificio', 'floor' => 'piso', 'unit_notes' => 'notas de unidad'] as $field => $label) {
            $this->validateMaxLength($preview, $normalized[$field], $label);
        }

        $hasResidentData = $this->hasResidentData($normalized);

        if (! $hasResidentData) {
            return $preview;
        }

        foreach (['first_name' => 'nombres', 'last_name' => 'apellidos'] as $field => $label) {
            if ($normalized[$field] === null) {
                $preview->addError("El campo {$label} es obligatorio para filas de residente.");
            }
        }

        foreach (['first_name' => 'nombres', 'last_name' => 'apellidos', 'phone' => 'telefono', 'email' => 'email'] as $field => $label) {
            $this->validateMaxLength($preview, $normalized[$field], $label);
        }

        if ($normalized['email'] !== null && filter_var($normalized['email'], FILTER_VALIDATE_EMAIL) === false) {
            $preview->addError('El correo electronico no tiene un formato valido.');
        }

        if ($normalized['resident_type'] === null) {
            $preview->addError('El tipo de residente es obligatorio para filas de residente.');
        } elseif (! ResidentType::tryFrom($normalized['resident_type'])) {
            $preview->addError('El tipo de residente no es valido.');
        }

        if (! RegistryStatus::tryFrom($normalized['membership_status'])) {
            $preview->addError('El estado de membresia no es valido.');
        }

        if (! is_bool($normalized['is_primary_contact'])) {
            $preview->addError('El valor de contacto principal no es valido.');
        }

        return $preview;
    }

    private function validateMaxLength(RegistryImportRowPreview $preview, mixed $value, string $label): void
    {
        if (is_string($value) && mb_strlen($value) > 255) {
            $preview->addError("El campo {$label} no puede superar 255 caracteres.");
        }
    }

    /**
     * @param  array<string, mixed>  $normalized
     */
    private function hasResidentData(array $normalized): bool
    {
        return $normalized['first_name'] !== null
            || $normalized['last_name'] !== null
            || $normalized['phone'] !== null
            || $normalized['email'] !== null
            || $normalized['resident_type'] !== null
            || $normalized['is_primary_contact'] === true;
    }

    private function normalizeResidentType(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = $this->normalizeToken($value);

        return match ($normalized) {
            'owner', 'propietario', 'propietaria', 'dueno', 'duena' => ResidentType::Owner->value,
            'tenant', 'inquilino', 'inquilina', 'arrendatario', 'arrendataria' => ResidentType::Tenant->value,
            'occupant', 'ocupante' => ResidentType::Occupant->value,
            'guest_resident', 'residente_invitado', 'residente_invitada', 'invitado', 'invitada' => ResidentType::GuestResident->value,
            default => $value,
        };
    }

    private function normalizeMembershipStatus(?string $value): string
    {
        if ($value === null) {
            return RegistryStatus::Active->value;
        }

        $normalized = $this->normalizeToken($value);

        return match ($normalized) {
            'active', 'activo', 'activa' => RegistryStatus::Active->value,
            'inactive', 'inactivo', 'inactiva' => RegistryStatus::Inactive->value,
            default => $value,
        };
    }

    private function normalizeBoolean(?string $value): bool|string
    {
        if ($value === null) {
            return false;
        }

        $normalized = $this->normalizeToken($value);

        return match ($normalized) {
            'si', 's', 'true', '1', 'yes' => true,
            'no', 'n', 'false', '0' => false,
            default => $value,
        };
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
            if ($preview->normalizedData['is_primary_contact'] !== true || $preview->status->value === 'error') {
                continue;
            }

            $key = $this->unitKey($preview->normalizedData);
            $primaryContactsByUnit[$key][] = $preview;
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

    /**
     * @param  array<string, mixed>  $normalized
     */
    private function unitKey(array $normalized): string
    {
        return Str::of((string) ($normalized['building_name'] ?? ''))
            ->ascii()
            ->lower()
            ->trim()
            ->append(':')
            ->append(Str::of((string) ($normalized['unit_number'] ?? ''))->ascii()->lower()->trim())
            ->toString();
    }
}
