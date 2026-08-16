<?php

namespace App\Http\Requests;

use App\Enums\VehicleType;
use App\Models\Unit;
use App\Models\User;
use App\Rules\AssignableUnit;
use App\Services\AccessAuthorizationService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePortalVehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The target unit comes from the payload, so the createAsResident
        // gate runs in the controller after validation resolves it.
        return true;
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
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['prohibited'],
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
        return [
            'string',
            'ulid',
            Rule::exists('units', 'id'),
            new AssignableUnit(
                function (Unit $unit): bool {
                    /** @var User $user */
                    $user = $this->user();

                    return app(AccessAuthorizationService::class)
                        ->activeResidentMembershipsForUser($user)
                        ->where('unit_id', $unit->id)
                        ->exists();
                },
                __('The selected unit is not available for vehicle assignment.'),
            ),
        ];
    }
}
