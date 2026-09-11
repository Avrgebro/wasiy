<?php

namespace App\Actions\Units;

use App\Actions\Reservations\DecideReservation;
use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\ReservationStatus;
use App\Models\Reservation;
use App\Models\Unit;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

/**
 * Mockup 12e: deactivating a home ends its memberships (portal access goes
 * with them), parks its vehicles as inactive and cancels future bookings —
 * which in turn voids pending charges and flags held deposits for refund.
 * Everything is logged; nothing is deleted.
 */
class DeactivateUnit
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly DecideReservation $decide,
    ) {}

    public function handle(Unit $unit, User $actor): Unit
    {
        return DB::transaction(function () use ($unit, $actor): Unit {
            $memberships = $unit->unitMemberships()->active()->get();
            foreach ($memberships as $membership) {
                $membership->forceFill([
                    'status' => RegistryStatus::Inactive,
                    'is_primary_contact' => false,
                    'ended_at' => $membership->ended_at ?? now()->toDateString(),
                ])->save();
            }

            $vehicles = $unit->vehicles()->where('status', RegistryStatus::Active->value)->get();
            foreach ($vehicles as $vehicle) {
                $vehicle->forceFill(['status' => RegistryStatus::Inactive])->save();
            }

            $reservations = Reservation::query()
                ->where('unit_id', $unit->id)
                ->whereIn('status', [ReservationStatus::Pending->value, ReservationStatus::Observed->value, ReservationStatus::Approved->value])
                ->where('starts_at', '>', now())
                ->get();
            foreach ($reservations as $reservation) {
                $this->decide->cancel($reservation, $actor, __('Unidad desactivada.'));
            }

            $unit->forceFill(['status' => RegistryStatus::Inactive])->save();

            $this->activityLogger->log(
                account: $unit->account,
                eventType: ActivityEventType::UnitInactivated,
                summary: "Unidad {$unit->label()} desactivada.",
                metadata: [
                    'unit_id' => $unit->id,
                    'unit_label' => $unit->label(),
                    'location_id' => $unit->location_id,
                    'memberships_ended' => $memberships->count(),
                    'vehicles_inactivated' => $vehicles->count(),
                    'reservations_cancelled' => $reservations->count(),
                ],
                location: $unit->location,
                actor: $actor,
                subjectType: Unit::class,
                subjectId: $unit->id,
            );

            return $unit;
        });
    }

    public function reactivate(Unit $unit, User $actor): Unit
    {
        $unit->forceFill(['status' => RegistryStatus::Active])->save();

        $this->activityLogger->log(
            account: $unit->account,
            eventType: ActivityEventType::UnitReactivated,
            summary: "Unidad {$unit->label()} reactivada.",
            metadata: ['unit_id' => $unit->id, 'unit_label' => $unit->label(), 'location_id' => $unit->location_id],
            location: $unit->location,
            actor: $actor,
            subjectType: Unit::class,
            subjectId: $unit->id,
        );

        return $unit;
    }
}
