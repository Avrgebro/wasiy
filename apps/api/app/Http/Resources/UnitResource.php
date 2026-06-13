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

        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'location_id' => $this->location_id,
            'unit_number' => $this->unit_number,
            'building_name' => $this->building_name,
            'floor' => $this->floor,
            'status' => $this->status->value,
            'notes' => $this->notes,
            'resident_count' => $this->active_unit_memberships_count ?? $this->unitMemberships()->active()->count(),
            'vehicle_count' => $this->vehicles_count ?? $this->vehicles()->count(),
            'primary_contact' => $primaryContactMembership instanceof UnitMembership && $primaryContactMembership->resident ? [
                'resident_id' => $primaryContactMembership->resident->id,
                'unit_membership_id' => $primaryContactMembership->id,
                'name' => $primaryContactMembership->resident->name,
                'phone' => $primaryContactMembership->resident->phone,
                'email' => $primaryContactMembership->resident->email,
                'resident_type' => $primaryContactMembership->resident_type->value,
            ] : null,
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
