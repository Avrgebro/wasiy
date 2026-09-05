<?php

namespace App\Http\Resources;

use App\Models\Unit;
use App\Models\UnitMembership;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Unit
 */
class UnitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var UnitMembership|null $primaryContactMembership */
        $primaryContactMembership = $this->whenLoaded('primaryContactMembership');
        $residentCount = $this->active_unit_memberships_count ?? $this->unitMemberships()->active()->count();
        $portalCount = $this->portal_memberships_count ?? $this->portalMemberships()->count();
        $invitedCount = $this->invited_memberships_count ?? $this->invitedMemberships()->count();

        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'location_id' => $this->location_id,
            'unit_number' => $this->unit_number,
            // The DB default only lands after a refresh; a just-created unit
            // has no attribute yet.
            'type' => $this->type?->value ?? UnitType::Apartment->value,
            'building_id' => $this->building_id,
            'building_name' => $this->building_name,
            'building_code' => $this->building?->code,
            'floor' => $this->floor,
            'participation_share' => $this->participation_share === null ? null : (float) $this->participation_share,
            'maintenance_fee' => $this->maintenance_fee,
            'parking_spots' => Unit::labels($this->parking_spots),
            'storage_rooms' => Unit::labels($this->storage_rooms),
            'status' => $this->status->value,
            'notes' => $this->notes,
            'resident_count' => $residentCount,
            'vehicle_count' => $this->vehicles_count ?? $this->vehicles()->count(),
            // Derived, never stored: how the list and the header read the unit.
            'occupancy' => $residentCount === 0 ? 'vacant' : ($primaryContactMembership instanceof UnitMembership ? 'occupied' : 'attention'),
            'portal_state' => $portalCount > 0 ? 'active' : ($invitedCount > 0 ? 'invited' : ($residentCount > 0 ? 'not_invited' : null)),
            'members' => $this->whenLoaded('activeUnitMemberships', fn () => $this->activeUnitMemberships
                ->map(fn (UnitMembership $membership): array => [
                    'membership_id' => $membership->id,
                    'resident_id' => $membership->resident_id,
                    'name' => $membership->resident->name,
                    'email' => $membership->resident->email,
                    'phone' => $membership->resident->phone,
                    'is_primary_contact' => $membership->is_primary_contact,
                    'started_at' => $membership->started_at?->toDateString(),
                    'portal_state' => $membership->resident->user_id !== null
                        ? 'active'
                        : ($membership->resident->userInvitations->contains(fn ($invitation) => $invitation->status === 'pending') ? 'invited' : 'not_invited'),
                ])
                ->values()
                ->all()),
            'vehicles' => VehicleResource::collection($this->whenLoaded('vehicles')),
            'primary_contact' => $primaryContactMembership instanceof UnitMembership && $primaryContactMembership->resident ? [
                'resident_id' => $primaryContactMembership->resident->id,
                'unit_membership_id' => $primaryContactMembership->id,
                'name' => $primaryContactMembership->resident->name,
                'phone' => $primaryContactMembership->resident->phone,
                'email' => $primaryContactMembership->resident->email,
            ] : null,
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
