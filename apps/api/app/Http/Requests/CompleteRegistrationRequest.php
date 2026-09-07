<?php

namespace App\Http\Requests;

use App\Actions\Registration\CompleteRegistration;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompleteRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->country)) {
            $this->merge(['country' => strtoupper($this->country)]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'address' => ['required', 'string', 'max:255'],
            'district' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            // Self-serve signup is Peru-only for launch (CompleteRegistration::COUNTRIES).
            'country' => ['required', 'string', Rule::in(CompleteRegistration::COUNTRIES)],
            'units' => ['required', 'integer', 'min:1', 'max:10000'],
            'plan' => ['required', 'string', Rule::exists('plans', 'code')->where('is_available', true)],
            'unit_price_minor' => ['required', 'integer', 'min:0'],
        ];
    }
}
