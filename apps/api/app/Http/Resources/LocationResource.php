<?php

namespace App\Http\Resources;

use App\Models\Location;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Location
 */
class LocationResource extends JsonResource
{
    /**
     * Counts come from the controller's withTileCounts() selects; the
     * fallbacks keep a bare model (fresh from a mutation) renderable
     * without a reload.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $deactivatedBy */
        $deactivatedBy = $this->whenLoaded('deactivatedBy');

        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'type' => $this->type->value,
            'timezone' => $this->timezone,
            'address_line1' => $this->address_line1,
            'address_line2' => $this->address_line2,
            'district' => $this->district,
            'city' => $this->city,
            'state' => $this->state,
            'postal_code' => $this->postal_code,
            'country' => $this->country,
            'formatted_address' => $this->formattedAddress(),
            'phone' => $this->phone,
            'contact_email' => $this->contact_email,
            'access_notes' => $this->access_notes,
            'status' => $this->isDeactivated() ? 'deactivated' : 'active',
            'deactivated_at' => $this->deactivated_at?->toJSON(),
            'deactivated_by' => $deactivatedBy instanceof User
                ? ['id' => $deactivatedBy->id, 'name' => $deactivatedBy->name]
                : null,
            'photos' => PhotoResource::collection($this->whenLoaded('photos')),
            'cover_photo_url' => $this->whenLoaded(
                'photos',
                fn () => $this->photos->firstWhere('is_cover', true)
                    ? url('/api/photos/'.$this->photos->firstWhere('is_cover', true)->id)
                    : null,
            ),
            'units_count' => (int) ($this->units_count ?? 0),
            'residents_count' => (int) ($this->residents_count ?? 0),
            'vehicles_count' => (int) ($this->vehicles_count ?? 0),
            'staff_count' => (int) ($this->staff_count ?? 0),
            'unclaimed_invitations_count' => (int) ($this->unclaimed_invitations_count ?? 0),
            'active_amenities_count' => (int) ($this->active_amenities_count ?? 0),
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
