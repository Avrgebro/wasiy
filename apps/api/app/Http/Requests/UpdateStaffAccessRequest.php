<?php

namespace App\Http\Requests;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Account;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStaffAccessRequest extends FormRequest
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
            'account_role' => ['present', 'nullable', Rule::enum(AccountRole::class)],
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

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            // Access types are mutually exclusive: the account admin role
            // already implies access to every location, so pairing it with
            // location assignments would create ambiguous access records.
            // Clearing both at once IS allowed — that is how staff access
            // gets fully removed.
            if ($this->input('account_role') !== null
                && count($this->input('location_assignments', [])) > 0) {
                $validator->errors()->add(
                    'location_assignments',
                    __('The account admin role cannot be combined with location assignments.'),
                );
            }
        });
    }
}
