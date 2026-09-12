<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The day arrives as a local date in the Location's calendar (ADR
     * 0043); ValidateReservationDay owns every semantic rule beyond shape.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'amenity_id' => ['required', 'string', 'ulid'],
            'unit_id' => ['required', 'string', 'ulid'],
            'resident_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'date' => ['required', 'date_format:Y-m-d'],
        ];
    }
}
