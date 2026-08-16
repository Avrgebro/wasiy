<?php

namespace App\Http\Requests;

use App\Enums\RegistryStatus;
use App\Enums\VehicleType;
use App\Models\Location;
use App\Models\Unit;
use App\Models\Vehicle;
use App\Rules\AssignableUnit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreVehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', [Vehicle::class, $this->location()]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'unit_id' => ['required', ...$this->unitRules()],
            'vehicle_type' => ['required', Rule::enum(VehicleType::class)],
            'plate' => ['sometimes', 'nullable', 'string', 'max:255'],
            'make' => ['sometimes', 'nullable', 'string', 'max:255'],
            'model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'color' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::enum(RegistryStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    public function unit(): Unit
    {
        return Unit::query()->findOrFail($this->validated()['unit_id']);
    }

    /**
     * @return array<int, mixed>
     */
    protected function unitRules(): array
    {
        $location = $this->location();

        return [
            'string',
            'ulid',
            Rule::exists('units', 'id')
                ->where('account_id', $location->account_id)
                ->where('location_id', $location->id),
            new AssignableUnit(
                fn (Unit $unit): bool => $unit->status === RegistryStatus::Active,
                __('The selected unit is not available for vehicle assignment.'),
            ),
        ];
    }

    protected function location(): Location
    {
        /** @var Location $location */
        $location = $this->route('location');

        return $location;
    }
}
