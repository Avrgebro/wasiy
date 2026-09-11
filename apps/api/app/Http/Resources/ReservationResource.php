<?php

namespace App\Http\Resources;

use App\Enums\ReservationStatus;
use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Reservation
 */
class ReservationResource extends JsonResource
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
            'amenity_id' => $this->amenity_id,
            'amenity_name' => $this->whenLoaded('amenity', fn () => $this->amenity->name),
            'unit_id' => $this->unit_id,
            'unit_number' => $this->whenLoaded('unit', fn () => $this->unit->unit_number),
            'resident_id' => $this->resident_id,
            'resident_name' => $this->whenLoaded('resident', fn () => $this->resident?->name),
            'resident_phone' => $this->whenLoaded('resident', fn () => $this->resident?->phone),
            'resident_email' => $this->whenLoaded('resident', fn () => $this->resident?->email),
            'starts_at' => $this->starts_at->toJSON(),
            'ends_at' => $this->ends_at->toJSON(),
            'status' => $this->status->value,
            // "Completada" is presentation, not state: approved and over.
            'is_completed' => $this->status === ReservationStatus::Approved
                && $this->ends_at->isPast(),
            'status_note' => $this->status_note,
            'fee_snapshot_minor' => $this->fee_snapshot_minor,
            'deposit_snapshot_minor' => $this->deposit_snapshot_minor,
            // Present once approved; pending requests have no ledger rows yet.
            'movements' => FinancialMovementResource::collection($this->whenLoaded('movements')),
            'created_by' => $this->created_by,
            'created_by_name' => $this->whenLoaded('createdBy', fn () => $this->createdBy?->name),
            'decided_by' => $this->decided_by,
            'decided_by_name' => $this->whenLoaded('decidedBy', fn () => $this->decidedBy?->name),
            'decided_at' => $this->decided_at?->toJSON(),
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
