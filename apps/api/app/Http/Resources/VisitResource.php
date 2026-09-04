<?php

namespace App\Http\Resources;

use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Visit */
class VisitResource extends JsonResource
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
            // The desk calls the host to confirm; phone only, never email (M11 rule).
            'resident_phone' => $this->whenLoaded('resident', fn () => $this->resident?->phone),
            'visitor_name' => $this->visitor_name,
            'document' => $this->document,
            'phone' => $this->phone,
            'confirmation' => $this->confirmation->value,
            'notes' => $this->notes,
            'status' => $this->status->value,
            'checked_in_at' => $this->checked_in_at->toJSON(),
            'checked_in_by_name' => $this->whenLoaded('checkedInBy', fn () => $this->checkedInBy?->name),
            'checked_out_at' => $this->checked_out_at?->toJSON(),
            'checked_out_by_name' => $this->whenLoaded('checkedOutBy', fn () => $this->checkedOutBy?->name),
            'checkout_notes' => $this->checkout_notes,
            'auto_checked_out' => $this->auto_checked_out,
        ];
    }
}
