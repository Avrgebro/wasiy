<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StartRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->email)) {
            $this->merge(['email' => mb_strtolower(trim($this->email))]);
        }
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc,filter', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'max:72', Password::default(), 'confirmed', function (string $attribute, mixed $value, \Closure $fail): void {
                if (is_string($value) && strlen($value) > 72) {
                    $fail('La contraseña es demasiado larga. Usa como máximo 72 bytes.');
                }
            }],
            'terms_accepted' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return ['email.email' => 'Ingresa un correo válido, por ejemplo ana@administradora.pe.', 'email.unique' => 'Este correo ya tiene una cuenta. Inicia sesión.', 'password.confirmed' => 'Las contraseñas no coinciden.'];
    }
}
