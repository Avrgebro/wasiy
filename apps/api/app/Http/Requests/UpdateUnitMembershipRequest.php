<?php

namespace App\Http\Requests;

use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Resident;
use App\Models\UnitMembership;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateUnitMembershipRequest extends StoreUnitMembershipRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->membership());
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'unit_id' => ['sometimes', ...$this->unitRules()],
            'resident_type' => ['sometimes', Rule::enum(ResidentType::class)],
            'status' => ['sometimes', Rule::enum(RegistryStatus::class)],
            'is_primary_contact' => ['sometimes', 'boolean'],
            'started_at' => ['sometimes', 'nullable', 'date'],
            'ended_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:started_at'],
        ];
    }

    protected function resident(): Resident
    {
        return $this->membership()->resident;
    }

    private function membership(): UnitMembership
    {
        /** @var UnitMembership $membership */
        $membership = $this->route('membership');

        return $membership;
    }
}
