<?php

namespace App\Http\Resources;

use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Package */
class PackageResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'location_id' => $this->location_id,
            'unit_id' => $this->unit_id,
            'unit_number' => $this->whenLoaded('unit', fn () => $this->unit->unit_number),
            'building_name' => $this->whenLoaded('unit', fn () => $this->unit->building_name),
            'resident_id' => $this->resident_id,
            'resident_name' => $this->whenLoaded('resident', fn () => $this->resident?->name),
            'notes' => $this->notes,
            'status' => $this->status->value,
            'received_at' => $this->received_at->toJSON(),
            'received_by_name' => $this->whenLoaded('receivedBy', fn () => $this->receivedBy?->name),
            'delivered_at' => $this->delivered_at?->toJSON(),
            'delivered_by_name' => $this->whenLoaded('deliveredBy', fn () => $this->deliveredBy?->name),
            'delivery_notes' => $this->delivery_notes,
            'notified_email' => $this->notified_email,
        ];
    }
}
