<?php

namespace App\Actions\Reservations;

use App\Actions\Finances\SyncReservationMovements;
use App\Enums\ActivityEventType;
use App\Enums\ReservationStatus;
use App\Models\Amenity;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\SettingsResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Every status transition in one place: approve re-runs the booking rule
 * under the same Amenity lock creation uses, so an approval can never
 * overshoot capacity that filled up while the request waited.
 */
class DecideReservation
{
    public function __construct(
        private readonly ValidateReservationSlot $validator,
        private readonly ActivityLogger $activityLogger,
        private readonly SettingsResolver $settings,
        private readonly SyncReservationMovements $movements,
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

            return $approved;
        });
    }

    public function reject(Reservation $reservation, User $actor, string $note): Reservation
    {
        $this->assertOpen($reservation);

        return $this->transition($reservation, $actor, ReservationStatus::Rejected, $note, ActivityEventType::ReservationRejected,
            "Se rechazó la reserva de {$reservation->amenity->name} para la unidad {$reservation->unit->unit_number}.");
    }

    public function observe(Reservation $reservation, User $actor, string $note): Reservation
    {
        $this->assertOpen($reservation);

        return $this->transition($reservation, $actor, ReservationStatus::Observed, $note, ActivityEventType::ReservationObserved,
            "Se observó la reserva de {$reservation->amenity->name} para la unidad {$reservation->unit->unit_number}.");
    }

    /**
     * Pending, observed, and approved reservations can be cancelled. An
     * approved reservation inside the amenity's cancellation window can only
     * be cancelled by an account admin ($bypassWindow).
     */
    public function cancel(Reservation $reservation, User $actor, ?string $note = null, bool $bypassWindow = false): Reservation
    {
        if ($reservation->status->isDecided() && $reservation->status !== ReservationStatus::Approved) {
            throw ValidationException::withMessages([
                'status' => __('This reservation can no longer be cancelled.'),
            ]);
        }

        if ($reservation->status === ReservationStatus::Approved && ! $bypassWindow) {
            $policy = $this->settings->bookingPolicyFor($reservation->amenity);
            $windowHours = $policy['cancellation_window_hours']['value'] ?? null;

            if ($windowHours !== null && now()->gt($reservation->starts_at->subHours($windowHours))) {
                throw ValidationException::withMessages([
                    'status' => __('The cancellation window for this reservation has closed.'),
                ]);
            }
        }

        return DB::transaction(function () use ($reservation, $actor, $note): Reservation {
            $cancelled = $this->transition($reservation, $actor, ReservationStatus::Cancelled, $note, ActivityEventType::ReservationCancelled,
                "Se canceló la reserva de {$reservation->amenity->name} para la unidad {$reservation->unit->unit_number}.");

            // Pending charges disappear; a held deposit is owed back.
            $this->movements->closeFor($cancelled, $actor);

            return $cancelled;
        });
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
