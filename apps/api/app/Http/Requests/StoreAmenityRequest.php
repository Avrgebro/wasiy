<?php

namespace App\Http\Requests;

use App\Enums\BookingMode;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAmenityRequest extends FormRequest
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
        return array_merge(
            ['name' => ['required', 'string', 'max:255']],
            self::sharedRules(),
        );
    }

    /**
     * Shape rules shared with UpdateAmenityRequest. Availability window
     * semantics (overlap, order) are owned by AmenityAvailability inside
     * SaveAmenity; these rules only reject malformed structure early with
     * field-level messages.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public static function sharedRules(): array
    {
        return [
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'is_reservable' => ['sometimes', 'boolean'],
            'booking_mode' => ['sometimes', Rule::enum(BookingMode::class)],
            'availability' => ['sometimes', 'nullable', 'array'],
            'availability.*' => ['array'],
            'availability.*.*.start' => ['required', 'date_format:H:i'],
            'availability.*.*.end' => ['required', 'date_format:H:i'],
            // Slot length (ADR 0041): whole half-hours between 30 minutes and 12 hours.
            'slot_minutes' => ['sometimes', 'integer', 'min:30', 'max:720', 'multiple_of:30'],
            'fee_amount_minor' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'deposit_amount_minor' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
        ];
    }
}
