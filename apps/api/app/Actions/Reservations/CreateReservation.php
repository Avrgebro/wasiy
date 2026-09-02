<?php

namespace App\Actions\Reservations;

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
        private readonly ValidateReservationSlot $validator,
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * Staff create on behalf of a unit. Instant amenities are approved on
     * the spot; approval-mode ones enter the queue as pending. The Amenity
     * row lock is the serialization point for every capacity check.
     */
    public function handle(
        Amenity $amenity,
        Unit $unit,
        ?Resident $resident,
        User $actor,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
    ): Reservation {
        return DB::transaction(function () use ($amenity, $unit, $resident, $actor, $startsAt, $endsAt): Reservation {
            Amenity::query()->whereKey($amenity->id)->lockForUpdate()->first();

            $this->validator->validate($amenity, $unit, $startsAt, $endsAt);

            $instant = $amenity->booking_mode === BookingMode::Instant;

            $reservation = new Reservation([
                'account_id' => $amenity->account_id,
                'location_id' => $amenity->location_id,
                'amenity_id' => $amenity->id,
                'unit_id' => $unit->id,
                'resident_id' => $resident?->id,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
            ]);
            $reservation->forceFill([
                'status' => $instant ? ReservationStatus::Approved : ReservationStatus::Pending,
                'fee_snapshot' => $amenity->fee_amount,
                'deposit_snapshot' => $amenity->deposit_amount,
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

            return $reservation;
        });
    }
}
