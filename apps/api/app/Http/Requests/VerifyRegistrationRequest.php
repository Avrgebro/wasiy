<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VerifyRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() === null;
    }

    public function rules(): array
    {
        return ['code' => ['required', 'string', 'regex:/^[0-9]{6}$/']];
    }
}
