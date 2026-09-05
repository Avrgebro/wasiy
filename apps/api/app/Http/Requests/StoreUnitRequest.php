<?php

namespace App\Http\Requests;

use App\Enums\UnitType;
use App\Models\Building;
use App\Models\Location;
use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'unit_number' => ['required', 'string', 'max:255'],
            'building_id' => ['sometimes', 'nullable', 'string', 'ulid', Rule::exists('buildings', 'id')->where('location_id', $this->route('location')?->id)],
            'floor' => ['sometimes', 'nullable', 'string', 'max:255'],
            'type' => ['sometimes', Rule::enum(UnitType::class)],
            'area_m2' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999'],
            'participation_share' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'maintenance_fee' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'parking_spots' => ['sometimes', 'nullable', 'string', 'max:255'],
            'storage_rooms' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Location $location */
            $location = $this->route('location');

            if ($this->hasDuplicateUnit(
                location: $location,
                unitNumber: $this->input('unit_number'),
                buildingId: $this->input('building_id'),
            )) {
                $validator->errors()->add('unit_number', __('The unit number has already been taken for this building and location.'));
            }
        });
    }

    /**
     * Trim the free-text identifiers. Only keys actually sent are merged, so
     * a partial PATCH (UpdateUnitRequest extends this) does not turn an
     * omitted unit_number into a null that fails `required`.
     */
    protected function prepareForValidation(): void
    {
        $trimmed = [];
        foreach (['unit_number', 'building_id', 'floor', 'parking_spots', 'storage_rooms'] as $key) {
            if ($this->has($key) && is_string($this->input($key))) {
                $trimmed[$key] = trim($this->input($key)) ?: null;
            }
        }
        if (isset($trimmed['unit_number']) === false && $this->has('unit_number') && is_string($this->input('unit_number'))) {
            $trimmed['unit_number'] = trim($this->input('unit_number'));
        }

        $this->merge($trimmed);
    }

    protected function hasDuplicateUnit(Location $location, mixed $unitNumber, mixed $buildingId, ?Unit $ignore = null): bool
    {
        // No building given means the location's default one (Unit::saving).
        $buildingId = is_string($buildingId) && $buildingId !== ''
            ? $buildingId
            : Building::resolveForLocation($location, null)->id;

        return Unit::query()
            ->where('location_id', $location->id)
            ->where('unit_number', $unitNumber)
            ->where('building_id', $buildingId)
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
            ->exists();
    }
}
