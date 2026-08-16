<?php

namespace App\Http\Requests;

use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Rules\AssignableUnit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreUnitMembershipRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The target unit comes from the payload, so the membership-create
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
            'resident_type' => ['required', Rule::enum(ResidentType::class)],
            'status' => ['sometimes', Rule::enum(RegistryStatus::class)],
            'is_primary_contact' => ['sometimes', 'boolean'],
            'started_at' => ['sometimes', 'nullable', 'date'],
            'ended_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:started_at'],
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
            Rule::exists('units', 'id')->where('account_id', $this->resident()->account_id),
            new AssignableUnit(
                fn (Unit $unit): bool => Gate::forUser($this->user())
                    ->allows('create', [UnitMembership::class, $unit->location]),
                __('The selected unit is not available for membership assignment.'),
            ),
        ];
    }

    protected function resident(): Resident
    {
        /** @var Resident $resident */
        $resident = $this->route('resident');

        return $resident;
    }
}
