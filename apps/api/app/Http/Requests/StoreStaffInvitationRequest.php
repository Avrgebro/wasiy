<?php

namespace App\Http\Requests;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Account;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreStaffInvitationRequest extends FormRequest
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
            'email' => ['required', 'string', 'email', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'account_role' => ['nullable', Rule::enum(AccountRole::class)],
            'location_assignments' => ['sometimes', 'array'],
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
            $hasAccountRole = $this->input('account_role') !== null;
            $hasLocationAssignments = count($this->input('location_assignments', [])) > 0;

            if (! $hasAccountRole && ! $hasLocationAssignments) {
                $validator->errors()->add(
                    'location_assignments',
                    __('A staff invitation must include an account role or at least one location assignment.'),
                );
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');

        if (is_string($email)) {
            $this->merge([
                'email' => Str::lower(trim($email)),
            ]);
        }
    }
}
