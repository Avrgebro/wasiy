<?php

namespace App\Http\Requests;

use App\Enums\VehicleType;
use App\Models\Vehicle;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdatePortalVehicleRequest extends StorePortalVehicleRequest
{
    public function authorize(): bool
    {
        /** @var Vehicle $vehicle */
        $vehicle = $this->route('vehicle');

        return Gate::allows('updateAsResident', $vehicle);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'unit_id' => ['sometimes', ...$this->unitRules()],
            'vehicle_type' => ['sometimes', Rule::enum(VehicleType::class)],
            'plate' => ['sometimes', 'nullable', 'string', 'max:255'],
            'make' => ['sometimes', 'nullable', 'string', 'max:255'],
            'model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'color' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['prohibited'],
        ];
    }
}
