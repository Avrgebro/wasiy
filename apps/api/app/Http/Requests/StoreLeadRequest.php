<?php

namespace App\Http\Requests;

use App\Models\Lead;
use App\Rules\VerifyTurnstile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLeadRequest extends FormRequest
{
    /** Hidden field humans never see; a value here means a bot filled the form. */
    public const HONEYPOT = 'website';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->email)) {
            $this->merge(['email' => mb_strtolower(trim($this->email))]);
        }
    }

    public function isFromBot(): bool
    {
        return filled($this->input(self::HONEYPOT));
    }

    public function rules(): array
    {
        return [
            'source' => ['required', Rule::in(Lead::SOURCES)],
            'name' => ['required', 'string', 'max:120', 'not_regex:/https?:\/\//i'],
            'email' => ['required', 'email:rfc,filter', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'organization' => ['nullable', 'string', 'max:150'],
            'profile' => ['nullable', 'string', 'max:60'],
            'units' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'units_range' => ['nullable', 'string', 'max:20'],
            'interests' => ['nullable', 'array', 'max:10'],
            'interests.*' => ['string', 'max:40'],
            'preferred_slot' => ['nullable', 'string', 'max:20'],
            'message' => ['nullable', 'string', 'max:2000'],
            self::HONEYPOT => ['nullable', 'string'],
            // Required only once a Turnstile secret is configured; 'nullable' would skip the rule on a missing token.
            // The widget's data-action is the lead source, so a token minted on one form cannot be replayed on the other.
            'turnstile_token' => [VerifyTurnstile::enabled() ? 'required' : 'nullable', 'string', 'max:2048', new VerifyTurnstile(expectedAction: is_string($this->source) ? $this->source : null, remoteIp: $this->ip())],
        ];
    }

    public function messages(): array
    {
        return [
            'name.not_regex' => 'El nombre no puede contener enlaces.',
            'email.email' => 'Ingresa un correo válido.',
            'turnstile_token.required' => 'No pudimos verificar que eres una persona. Recarga la página e inténtalo otra vez.',
        ];
    }
}
