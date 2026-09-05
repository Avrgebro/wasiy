<?php

namespace App\Http\Requests;

use App\Data\OperationalSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Merge-write contract for one level of the settings cascade: a key present
 * with a value becomes this level's override, a key present as null clears
 * the override back to inherited, an absent key is untouched. Unknown keys
 * are rejected so a stale client cannot write junk into the json column.
 */
class UpdateOperationalSettingsRequest extends FormRequest
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
        return [
            'visitor_preregistration_enabled' => ['sometimes', 'nullable', 'boolean'],
            // 0 means "never close automatically"; null clears the override.
            'visitor_auto_checkout_hours' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:168'],
            'reservation_max_advance_days' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:365'],
            'reservation_max_concurrent_per_unit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:50'],
            'reservation_cancellation_window_hours' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:720'],
            'quiet_hours_enabled' => ['sometimes', 'nullable', 'boolean'],
            'quiet_hours_start' => ['sometimes', 'nullable', 'date_format:H:i'],
            'quiet_hours_end' => ['sometimes', 'nullable', 'date_format:H:i'],
            'announcements_location_manager_can_post' => ['sometimes', 'nullable', 'boolean'],
            'announcements_email_residents' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_keys($this->all()) as $key) {
                if (! array_key_exists($key, OperationalSettings::DEFAULTS)) {
                    $validator->errors()->add((string) $key, __('Unknown setting.'));
                }
            }
        });
    }
}
