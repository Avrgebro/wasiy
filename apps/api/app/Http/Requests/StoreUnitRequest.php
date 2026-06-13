<?php

namespace App\Http\Requests;

use App\Models\Location;
use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
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
            'building_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'floor' => ['sometimes', 'nullable', 'string', 'max:255'],
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
                buildingName: $this->input('building_name'),
            )) {
                $validator->errors()->add('unit_number', __('The unit number has already been taken for this building and location.'));
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'unit_number' => is_string($this->input('unit_number')) ? trim($this->input('unit_number')) : $this->input('unit_number'),
            'building_name' => is_string($this->input('building_name')) ? trim($this->input('building_name')) : $this->input('building_name'),
            'floor' => is_string($this->input('floor')) ? trim($this->input('floor')) : $this->input('floor'),
        ]);
    }

    protected function hasDuplicateUnit(Location $location, mixed $unitNumber, mixed $buildingName, ?Unit $ignore = null): bool
    {
        return Unit::query()
            ->where('location_id', $location->id)
            ->where('unit_number', $unitNumber)
            ->where(function ($query) use ($buildingName): void {
                if ($buildingName === null || $buildingName === '') {
                    $query->whereNull('building_name')->orWhere('building_name', '');

                    return;
                }

                $query->where('building_name', $buildingName);
            })
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
            ->exists();
    }
}
