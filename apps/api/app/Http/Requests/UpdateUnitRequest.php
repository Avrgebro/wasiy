<?php

namespace App\Http\Requests;

use App\Enums\RegistryStatus;
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
            'building_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'floor' => ['sometimes', 'nullable', 'string', 'max:255'],
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
                buildingName: $this->has('building_name') ? $this->input('building_name') : $unit->building_name,
                ignore: $unit,
            )) {
                $validator->errors()->add('unit_number', __('The unit number has already been taken for this building and location.'));
            }
        });
    }
}
