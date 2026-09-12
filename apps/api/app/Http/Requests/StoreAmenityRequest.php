<?php

namespace App\Http\Requests;

use App\Enums\BookingMode;
use App\Enums\Weekday;
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
     * Shape rules shared with UpdateAmenityRequest. Whether a reservable
     * amenity opens at least one day is SaveAmenity's rule; these only
     * reject malformed structure early with field-level messages.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public static function sharedRules(): array
    {
        return [
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'is_reservable' => ['sometimes', 'boolean'],
            'booking_mode' => ['sometimes', Rule::enum(BookingMode::class)],
            // Open weekdays and an optional daily capacity (ADR 0043).
            'open_days' => ['sometimes', 'array'],
            'open_days.*' => ['string', 'distinct', Rule::enum(Weekday::class)],
            'daily_capacity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:1000'],
            'fee_amount_minor' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'deposit_amount_minor' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
        ];
    }
}
