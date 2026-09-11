<?php

namespace App\Http\Resources;

use App\Enums\MovementStatus;
use App\Models\FinancialMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FinancialMovement
 */
class FinancialMovementResource extends JsonResource
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
            'direction' => $this->direction->value,
            'category' => $this->category->value,
            'status' => $this->status->value,
            // The row's own next moves, so the UI never guesses the machine.
            'allowed_transitions' => array_map(
                fn (MovementStatus $status): string => $status->value,
                $this->allowedTransitions(),
            ),
            'amount_minor' => $this->amount_minor,
            'concept' => $this->concept,
            'detail' => $this->detail,
            'counterparty' => $this->counterparty,
            'unit_id' => $this->unit_id,
            'unit_number' => $this->whenLoaded('unit', fn () => $this->unit?->unit_number),
            'reservation_id' => $this->reservation_id,
            'reservation' => $this->whenLoaded('reservation', fn () => $this->reservation === null ? null : [
                'id' => $this->reservation->id,
                'amenity_name' => $this->reservation->amenity?->name,
                'starts_at' => $this->reservation->starts_at->toJSON(),
                'status' => $this->reservation->status->value,
            ]),
            'occurred_on' => $this->occurred_on->toDateString(),
            'period' => $this->period,
            'due_on' => $this->due_on?->toDateString(),
            'note' => $this->note,
            'created_by' => $this->created_by,
            'created_by_name' => $this->whenLoaded('createdBy', fn () => $this->createdBy?->name),
            'settled_by' => $this->settled_by,
            'settled_by_name' => $this->whenLoaded('settledBy', fn () => $this->settledBy?->name),
            'settled_at' => $this->settled_at?->toJSON(),
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
