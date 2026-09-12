<?php

namespace App\Actions\Reservations;

use App\Actions\Finances\SyncReservationMovements;
use App\Enums\ActivityEventType;
use App\Enums\BookingMode;
use App\Enums\ReservationStatus;
use App\Models\Amenity;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\User;
use App\Services\ActivityLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CreateReservation
{
    public function __construct(
        private readonly ValidateReservationDay $validator,
        private readonly ActivityLogger $activityLogger,
        private readonly SyncReservationMovements $movements,
    ) {}

    /**
     * Book one day. Instant amenities are approved on the spot; approval-mode
     * ones enter the queue as pending. A resident's request ($asResident)
     * also respects the daily capacity; staff are never blocked by it (ADR
     * 0043). The transaction keeps the row, its activity entry and its
     * movements together, and serialises the capacity check against
     * concurrent approvals.
     */
    public function handle(
        Amenity $amenity,
        Unit $unit,
        ?Resident $resident,
        User $actor,
        CarbonImmutable $reservedOn,
        bool $asResident = false,
    ): Reservation {
        return DB::transaction(function () use ($amenity, $unit, $resident, $actor, $reservedOn, $asResident): Reservation {
            $this->validator->validate($amenity, $unit, $reservedOn);

            if ($asResident) {
                $this->validator->assertNotFull($amenity, $reservedOn);
            }

            $instant = $amenity->booking_mode === BookingMode::Instant;

            $reservation = new Reservation([
                'account_id' => $amenity->account_id,
                'location_id' => $amenity->location_id,
                'amenity_id' => $amenity->id,
                'unit_id' => $unit->id,
                'resident_id' => $resident?->id,
                'reserved_on' => $reservedOn->toDateString(),
            ]);
            $reservation->forceFill([
                'status' => $instant ? ReservationStatus::Approved : ReservationStatus::Pending,
                'fee_snapshot_minor' => $amenity->fee_amount_minor,
                'deposit_snapshot_minor' => $amenity->deposit_amount_minor,
                'created_by' => $actor->id,
                'decided_by' => $instant ? $actor->id : null,
                'decided_at' => $instant ? now() : null,
            ]);
            $reservation->save();

            $this->activityLogger->log(
                account: $amenity->account,
                eventType: ActivityEventType::ReservationCreated,
                summary: "Se registró una reserva de {$amenity->name} para la unidad {$unit->unit_number}.",
                metadata: ReservationMetadata::for($reservation),
                location: $amenity->location,
                actor: $actor,
                subjectType: 'reservation',
                subjectId: $reservation->id,
            );

            if ($instant) {
                $this->movements->openFor($reservation, $actor);
            }

            return $reservation;
        });
    }
}
