<?php

namespace App\Http\Requests;

use App\Enums\LocationType;
use App\Models\Location;
use App\Support\PhoneNumber;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Location $location */
        $location = $this->route('location');

        return [
            'name' => [
                'sometimes', 'required', 'string', 'max:255',
                Rule::unique('locations', 'name')
                    ->where('account_id', $location->account_id)
                    ->whereNull('deleted_at')
                    ->ignore($location->id),
            ],
            'type' => ['sometimes', 'required', Rule::enum(LocationType::class)],
            'timezone' => ['sometimes', 'string', 'timezone:all'],
            'address_line1' => ['sometimes', 'required', 'string', 'max:255'],
            'address_line2' => ['sometimes', 'nullable', 'string', 'max:255'],
            'district' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'required', 'string', 'max:255'],
            'state' => ['sometimes', 'nullable', 'string', 'max:255'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:32'],
            'country' => ['sometimes', 'string', 'size:2', 'alpha'],
            'phone' => ['sometimes', ...PhoneNumber::rules((string) $this->input('country', $this->route('location')?->country ?? PhoneNumber::FALLBACK_COUNTRY))],
            'contact_email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
            'access_notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }

        if (is_string($this->input('country'))) {
            $this->merge(['country' => strtoupper($this->input('country'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated($key, $default);
        if ($key === null && is_array($validated) && array_key_exists('phone', $validated)) {
            $validated['phone'] = PhoneNumber::normalize($validated['phone'], (string) $this->input('country', $this->route('location')?->country ?? PhoneNumber::FALLBACK_COUNTRY));
        }

        return $validated;
    }
}
