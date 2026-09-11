<?php

namespace App\Http\Resources;

use App\Models\Amenity;
use App\Services\SettingsResolver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Amenity
 */
class AmenityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'location_id' => $this->location_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_reservable' => $this->is_reservable,
            'capacity' => $this->capacity,
            'booking_mode' => $this->booking_mode->value,
            'availability' => $this->availability ?? (object) [],
            'max_duration_minutes' => $this->max_duration_minutes,
            'min_duration_minutes' => $this->min_duration_minutes,
            'buffer_minutes' => $this->buffer_minutes,
            'max_advance_days' => $this->max_advance_days,
            'max_concurrent_per_unit' => $this->max_concurrent_per_unit,
            'cancellation_window_hours' => $this->cancellation_window_hours,
            // Own values above, resolved values here: the UI shows inherited
            // defaults as placeholders and the reservations milestone reads
            // one effective number.
            'effective_booking_policy' => $this->is_reservable
                ? app(SettingsResolver::class)->bookingPolicyFor($this->resource)
                : null,
            'fee_amount' => $this->fee_amount,
            'deposit_amount' => $this->deposit_amount,
            'status' => $this->isDeactivated() ? 'deactivated' : 'active',
            'deactivated_at' => $this->deactivated_at?->toJSON(),
            'photos' => PhotoResource::collection($this->whenLoaded('photos')),
            'cover_photo_url' => $this->whenLoaded(
                'photos',
                fn () => $this->photos->firstWhere('is_cover', true)
                    ? url('/api/photos/'.$this->photos->firstWhere('is_cover', true)->id)
                    : null,
            ),
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
