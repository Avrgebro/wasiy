<?php

namespace App\Http\Requests;

use App\Enums\RegistryStatus;
use App\Enums\UnitType;
use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateUnitRequest extends StoreUnitRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'unit_number' => ['sometimes', 'required', 'string', 'max:255'],
            'building_id' => [
                'sometimes',
                Rule::requiredIf(fn (): bool => ($this->route('unit')?->location?->buildings()->count() ?? 0) > 1),
                'nullable', 'string', 'ulid',
                Rule::exists('buildings', 'id')->where('location_id', $this->route('unit')?->location_id),
            ],
            'floor' => ['sometimes', 'nullable', 'string', 'max:255'],
            'type' => ['sometimes', Rule::enum(UnitType::class)],
            'participation_share' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'maintenance_fee_minor' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'parking_spots' => ['sometimes', 'nullable', 'string', 'max:255'],
            'storage_rooms' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'required', Rule::enum(RegistryStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Unit $unit */
            $unit = $this->route('unit');

            if ($this->hasDuplicateUnit(
                location: $unit->location,
                unitNumber: $this->input('unit_number', $unit->unit_number),
                buildingId: $this->has('building_id') ? $this->input('building_id') : $unit->building_id,
                ignore: $unit,
            )) {
                $validator->errors()->add('unit_number', __('The unit number has already been taken for this building and location.'));
            }
        });
    }
}
