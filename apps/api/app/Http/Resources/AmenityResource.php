<?php

namespace App\Http\Resources;

use App\Models\Amenity;
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
            'booking_mode' => $this->booking_mode->value,
            'availability' => $this->availability ?? (object) [],
            'slot_minutes' => $this->slotMinutes(),
            'fee_amount_minor' => $this->fee_amount_minor,
            'deposit_amount_minor' => $this->deposit_amount_minor,
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
