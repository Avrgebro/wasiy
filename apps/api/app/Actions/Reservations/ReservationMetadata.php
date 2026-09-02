<?php

namespace App\Actions\Reservations;

use App\Models\Reservation;

class ReservationMetadata
{
    /**
     * Shared activity-log metadata for every reservation event, following
     * the staff-invitation pattern: enough identifiers to reconstruct the
     * story without joining live tables.
     *
     * @return array<string, mixed>
     */
    public static function for(Reservation $reservation, ?string $previousStatus = null): array
    {
        $reservation->loadMissing(['amenity', 'unit', 'resident']);

        return array_filter([
            'reservation_id' => $reservation->id,
            'amenity_id' => $reservation->amenity_id,
            'amenity_name' => $reservation->amenity?->name,
            'unit_id' => $reservation->unit_id,
            'unit_number' => $reservation->unit?->unit_number,
            'resident_id' => $reservation->resident_id,
            'resident_name' => $reservation->resident?->name,
            'starts_at' => $reservation->starts_at?->toJSON(),
            'ends_at' => $reservation->ends_at?->toJSON(),
            'status' => $reservation->status->value,
            'previous_status' => $previousStatus,
            'status_note' => $reservation->status_note,
            'fee_snapshot' => $reservation->fee_snapshot,
            'deposit_snapshot' => $reservation->deposit_snapshot,
        ], fn (mixed $value): bool => $value !== null);
    }
}
