<?php

namespace App\Actions\Finances;

use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Models\FinancialMovement;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * The reservations module's only touch on the ledger. Approval opens one
 * row per fee and per deposit from the snapshots; cancellation voids what
 * is still pending and flags a held deposit for refund. Idempotent through
 * the (reservation_id, category) unique index.
 */
class SyncReservationMovements
{
    public function __construct(
        private readonly RecordMovement $record,
        private readonly TransitionMovement $transition,
    ) {}

    public function openFor(Reservation $reservation, User $actor): void
    {
        $reservation->loadMissing(['amenity', 'unit', 'resident', 'location']);

        foreach ([
            [MovementCategory::ReservationFee, $reservation->fee_snapshot_minor, 'Cuota'],
            [MovementCategory::ReservationDeposit, $reservation->deposit_snapshot_minor, 'Depósito'],
        ] as [$category, $amount, $label]) {
            if ($amount === null || $amount <= 0) {
                continue;
            }

            $exists = FinancialMovement::query()
                ->where('reservation_id', $reservation->id)
                ->where('category', $category->value)
                ->exists();

            if ($exists) {
                continue;
            }

            $this->record->handle($reservation->location, $actor, [
                'direction' => MovementDirection::Income,
                'category' => $category,
                'amount_minor' => $amount,
                'concept' => "{$label} · {$reservation->amenity->name}",
                'detail' => $this->detailFor($reservation),
                'unit_id' => $reservation->unit_id,
                'reservation_id' => $reservation->id,
                'occurred_on' => CarbonImmutable::now($reservation->location->timezone)->toDateString(),
            ]);
        }
    }

    public function closeFor(Reservation $reservation, User $actor): void
    {
        $movements = FinancialMovement::query()
            ->where('reservation_id', $reservation->id)
            ->get();

        foreach ($movements as $movement) {
            if ($movement->status === MovementStatus::Pending) {
                $this->transition->handle($movement, $actor, MovementStatus::Voided);
            } elseif ($movement->status === MovementStatus::Held) {
                $this->transition->handle($movement, $actor, MovementStatus::ToRefund);
            }
        }
    }

    private function detailFor(Reservation $reservation): string
    {
        $start = $reservation->starts_at->setTimezone($reservation->location->timezone)->locale('es');
        $slot = 'Reserva del '.$start->isoFormat('ddd D, HH:mm');

        return $reservation->resident !== null
            ? "{$slot} · {$reservation->resident->name}"
            : $slot;
    }
}
