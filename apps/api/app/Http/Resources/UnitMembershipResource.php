<?php

namespace App\Http\Resources;

use App\Models\UnitMembership;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin UnitMembership
 */
class UnitMembershipResource extends JsonResource
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
            'unit_id' => $this->unit_id,
            'resident_id' => $this->resident_id,
            'resident_type' => $this->resident_type->value,
            'status' => $this->status->value,
            'is_primary_contact' => $this->is_primary_contact,
            'started_at' => $this->started_at?->toDateString(),
            'ended_at' => $this->ended_at?->toDateString(),
            'unit' => $this->whenLoaded('unit', fn () => [
                'id' => $this->unit->id,
                'unit_number' => $this->unit->unit_number,
                'building_name' => $this->unit->building_name,
                'floor' => $this->unit->floor,
            ]),
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
