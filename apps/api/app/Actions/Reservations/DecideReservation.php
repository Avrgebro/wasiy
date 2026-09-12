<?php

namespace App\Actions\Reservations;

use App\Actions\Finances\SyncReservationMovements;
use App\Enums\ActivityEventType;
use App\Enums\ReservationStatus;
use App\Enums\ResidentAlertKind;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ResidentAlerts;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Every status transition in one place: approve re-runs the booking rule so
 * an approval never lands on an amenity that stopped accepting bookings or
 * on a weekday it no longer opens. Capacity never blocks an approval: the
 * count is the approver's to weigh (ADR 0043).
 */
class DecideReservation
{
    public function __construct(
        private readonly ValidateReservationDay $validator,
        private readonly ActivityLogger $activityLogger,
        private readonly SyncReservationMovements $movements,
        private readonly ResidentAlerts $alerts,
    ) {}

    public function approve(Reservation $reservation, User $actor): Reservation
    {
        $this->assertOpen($reservation);

        return DB::transaction(function () use ($reservation, $actor): Reservation {
            $this->validator->validate($reservation->amenity, $reservation->unit, $reservation->reserved_on, creating: false);

            $approved = $this->transition($reservation, $actor, ReservationStatus::Approved, null, ActivityEventType::ReservationApproved,
                "Se aprobó la reserva de {$reservation->amenity->name} para la unidad {$reservation->unit->unit_number}.");

            // Approval is when a booking starts owing money (ADR 0034).
            $this->movements->openFor($approved, $actor);

            $this->alert($approved, ResidentAlertKind::ReservationApproved, 'Tu reserva fue aprobada', null);

            return $approved;
        });
    }

    public function reject(Reservation $reservation, User $actor, string $note): Reservation
    {
        $this->assertOpen($reservation);

        return DB::transaction(function () use ($reservation, $actor, $note): Reservation {
            $rejected = $this->transition($reservation, $actor, ReservationStatus::Rejected, $note, ActivityEventType::ReservationRejected,
                "Se rechazó la reserva de {$reservation->amenity->name} para la unidad {$reservation->unit->unit_number}.");
            $this->alert($rejected, ResidentAlertKind::ReservationRejected, 'Tu reserva fue rechazada', $note);

            return $rejected;
        });
    }

    public function observe(Reservation $reservation, User $actor, string $note): Reservation
    {
        $this->assertOpen($reservation);

        return DB::transaction(function () use ($reservation, $actor, $note): Reservation {
            $observed = $this->transition($reservation, $actor, ReservationStatus::Observed, $note, ActivityEventType::ReservationObserved,
                "Se observó la reserva de {$reservation->amenity->name} para la unidad {$reservation->unit->unit_number}.");
            $this->alert($observed, ResidentAlertKind::ReservationObserved, 'Tu reserva fue observada', $note);

            return $observed;
        });
    }

    /**
     * Pending, observed, and approved reservations can be cancelled. Staff
     * may cancel at any time; a resident ($asResident) only until the start
     * of the booked day in the Location's timezone (ADR 0043).
     */
    public function cancel(Reservation $reservation, User $actor, ?string $note = null, bool $asResident = false): Reservation
    {
        if ($reservation->status->isDecided() && $reservation->status !== ReservationStatus::Approved) {
            throw ValidationException::withMessages([
                'status' => __('This reservation can no longer be cancelled.'),
            ]);
        }

        if ($asResident && ! $reservation->isTodayOrLater()) {
            throw ValidationException::withMessages([
                'status' => __('A reservation whose day has arrived can no longer be cancelled.'),
            ]);
        }

        return DB::transaction(function () use ($reservation, $actor, $note): Reservation {
            $cancelled = $this->transition($reservation, $actor, ReservationStatus::Cancelled, $note, ActivityEventType::ReservationCancelled,
                "Se canceló la reserva de {$reservation->amenity->name} para la unidad {$reservation->unit->unit_number}.");

            // Pending charges disappear; a held deposit is owed back.
            $this->movements->closeFor($cancelled, $actor);

            return $cancelled;
        });
    }

    /** Decisions reach the unit's residents in the portal and, if they kept the switch on, by email (P3). */
    private function alert(Reservation $reservation, ResidentAlertKind $kind, string $title, ?string $note): void
    {
        $reservation->loadMissing(['amenity', 'unit']);
        $day = $reservation->reserved_on->locale('es');

        $this->alerts->send(
            unit: $reservation->unit,
            kind: $kind,
            title: $title,
            body: $reservation->amenity->name.' · '.$day->isoFormat('ddd D MMM').($note ? " · {$note}" : ''),
            subject: $reservation,
            facts: array_values(array_filter([
                ['label' => 'Amenidad', 'value' => $reservation->amenity->name],
                ['label' => 'Fecha', 'value' => ucfirst($day->isoFormat('dddd D [de] MMMM'))],
                ['label' => 'Unidad', 'value' => $reservation->unit->label()],
                $reservation->fee_snapshot_minor ? ['label' => 'Costo', 'value' => Money::soles($reservation->fee_snapshot_minor)] : null,
                $reservation->deposit_snapshot_minor ? ['label' => 'Depósito', 'value' => Money::soles($reservation->deposit_snapshot_minor)] : null,
                $note ? ['label' => 'Nota', 'value' => $note] : null,
            ])),
            intro: match ($kind) {
                ResidentAlertKind::ReservationApproved => 'Administración confirmó tu solicitud. Estos son los datos de la reserva.',
                ResidentAlertKind::ReservationObserved => 'Administración observó tu solicitud y necesita algo más antes de aprobarla.',
                default => 'Administración no aprobó tu solicitud.',
            },
            actionLabel: 'Ver reserva',
            actionPath: '/portal/reservas',
        );
    }

    private function assertOpen(Reservation $reservation): void
    {
        if (! in_array($reservation->status, [ReservationStatus::Pending, ReservationStatus::Observed], true)) {
            throw ValidationException::withMessages([
                'status' => __('Only pending or observed reservations can be decided.'),
            ]);
        }
    }

    private function transition(
        Reservation $reservation,
        User $actor,
        ReservationStatus $status,
        ?string $note,
        ActivityEventType $eventType,
        string $summary,
    ): Reservation {
        $previous = $reservation->status->value;

        $reservation->forceFill([
            'status' => $status,
            'status_note' => $note,
            'decided_by' => $actor->id,
            'decided_at' => now(),
        ])->save();

        $this->activityLogger->log(
            account: $reservation->account,
            eventType: $eventType,
            summary: $summary,
            metadata: ReservationMetadata::for($reservation, $previous),
            location: $reservation->location,
            actor: $actor,
            subjectType: 'reservation',
            subjectId: $reservation->id,
        );

        return $reservation;
    }
}
