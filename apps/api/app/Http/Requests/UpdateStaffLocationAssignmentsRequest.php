<?php

namespace App\Http\Requests;

use App\Enums\LocationRole;
use App\Models\Account;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStaffLocationAssignmentsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Account $account */
        $account = $this->route('account');

        return [
            'location_assignments' => ['present', 'array'],
            'location_assignments.*.location_id' => [
                'required',
                'string',
                'ulid',
                'distinct:strict',
                Rule::exists('locations', 'id')
                    ->where('account_id', $account->id)
                    ->whereNull('deleted_at'),
            ],
            'location_assignments.*.role' => ['required', Rule::enum(LocationRole::class)],
        ];
    }
}
