<?php

namespace App\Http\Requests;

use App\Enums\RegistryStatus;
use App\Enums\VehicleType;
use App\Models\Location;
use App\Models\Vehicle;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateVehicleRequest extends StoreVehicleRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->vehicle());
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
            'status' => ['sometimes', Rule::enum(RegistryStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    protected function location(): Location
    {
        return $this->vehicle()->location;
    }

    private function vehicle(): Vehicle
    {
        /** @var Vehicle $vehicle */
        $vehicle = $this->route('vehicle');

        return $vehicle;
    }
}
