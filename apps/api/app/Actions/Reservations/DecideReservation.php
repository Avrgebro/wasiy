<?php

namespace App\Actions\Reservations;

use App\Actions\Finances\SyncReservationMovements;
use App\Enums\ActivityEventType;
use App\Enums\ReservationStatus;
use App\Enums\ResidentAlertKind;
use App\Models\Amenity;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ResidentAlerts;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Every status transition in one place: approve re-runs the booking rule
 * under the same Amenity lock creation uses, so an approval can never land
 * on a slot that was taken while the request waited.
 */
class DecideReservation
{
    public function __construct(
        private readonly ValidateReservationSlot $validator,
        private readonly ActivityLogger $activityLogger,
        private readonly SyncReservationMovements $movements,
        private readonly ResidentAlerts $alerts,
    ) {}

    public function approve(Reservation $reservation, User $actor): Reservation
    {
        $this->assertOpen($reservation);

        return DB::transaction(function () use ($reservation, $actor): Reservation {
            Amenity::query()->whereKey($reservation->amenity_id)->lockForUpdate()->first();

            $this->validator->validate(
                $reservation->amenity,
                $reservation->unit,
                $reservation->starts_at,
                $reservation->ends_at,
                ignore: $reservation,
            );

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
     * may cancel at any time; a resident ($asResident) only while the
     * booking has not started (ADR 0041).
     */
    public function cancel(Reservation $reservation, User $actor, ?string $note = null, bool $asResident = false): Reservation
    {
        if ($reservation->status->isDecided() && $reservation->status !== ReservationStatus::Approved) {
            throw ValidationException::withMessages([
                'status' => __('This reservation can no longer be cancelled.'),
            ]);
        }

        if ($asResident && $reservation->starts_at->lte(now())) {
            throw ValidationException::withMessages([
                'status' => __('A reservation that has started can no longer be cancelled.'),
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
        $reservation->loadMissing(['amenity', 'unit.location']);
        $timezone = $reservation->unit->location->timezone;
        $starts = $reservation->starts_at->setTimezone($timezone)->locale('es');
        $ends = $reservation->ends_at->setTimezone($timezone);

        $this->alerts->send(
            unit: $reservation->unit,
            kind: $kind,
            title: $title,
            body: $reservation->amenity->name.' · '.$starts->isoFormat('ddd D MMM, HH:mm').'–'.$ends->format('H:i').($note ? " · {$note}" : ''),
            subject: $reservation,
            facts: array_values(array_filter([
                ['label' => 'Amenidad', 'value' => $reservation->amenity->name],
                ['label' => 'Fecha', 'value' => ucfirst($starts->isoFormat('dddd D [de] MMMM'))],
                ['label' => 'Horario', 'value' => $starts->format('H:i').' – '.$ends->format('H:i')],
                ['label' => 'Unidad', 'value' => $reservation->unit->label()],
                $reservation->fee_snapshot ? ['label' => 'Costo', 'value' => 'S/ '.number_format((float) $reservation->fee_snapshot, 0)] : null,
                $reservation->deposit_snapshot ? ['label' => 'Depósito', 'value' => 'S/ '.number_format((float) $reservation->deposit_snapshot, 0)] : null,
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
