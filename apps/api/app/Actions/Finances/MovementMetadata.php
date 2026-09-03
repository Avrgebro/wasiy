<?php

namespace App\Actions\Finances;

use App\Models\FinancialMovement;

class MovementMetadata
{
    /**
     * Activity-log metadata for every movement event: enough to tell the
     * story without joining live tables, like ReservationMetadata.
     *
     * @return array<string, mixed>
     */
    public static function for(FinancialMovement $movement, ?string $previousStatus = null): array
    {
        $movement->loadMissing(['unit']);

        return array_filter([
            'movement_id' => $movement->id,
            'direction' => $movement->direction->value,
            'category' => $movement->category->value,
            'status' => $movement->status->value,
            'previous_status' => $previousStatus,
            'amount' => $movement->amount,
            'concept' => $movement->concept,
            'counterparty' => $movement->counterparty,
            'unit_id' => $movement->unit_id,
            'unit_number' => $movement->unit?->unit_number,
            'reservation_id' => $movement->reservation_id,
            'occurred_on' => $movement->occurred_on->toDateString(),
        ], fn (mixed $value): bool => $value !== null);
    }
}
