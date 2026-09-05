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
     * Times arrive as wall-clock in the Location's timezone (date + HH:MM)
     * so the client never converts; ValidateReservationSlot owns every
     * semantic rule beyond shape.
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
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i'],
        ];
    }
}
