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
            'capacity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100000'],
            'booking_mode' => ['sometimes', Rule::enum(BookingMode::class)],
            'availability' => ['sometimes', 'nullable', 'array'],
            'availability.*' => ['array'],
            'availability.*.*.start' => ['required', 'date_format:H:i'],
            'availability.*.*.end' => ['required', 'date_format:H:i'],
            'max_duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:15', 'max:1440'],
            'min_duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:15', 'max:1440'],
            'buffer_minutes' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:720'],
            'max_advance_days' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:365'],
            'max_concurrent_per_unit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:50'],
            'cancellation_window_hours' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:720'],
            'fee_amount' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:1000000'],
            'deposit_amount' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:1000000'],
        ];
    }
}
