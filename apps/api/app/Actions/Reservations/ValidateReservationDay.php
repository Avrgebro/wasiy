<?php

namespace App\Actions\Reservations;

use App\Models\Amenity;
use App\Models\Unit;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * The booking rule (ADR 0043), shared by create and approve so both paths
 * agree: the amenity accepts bookings, the unit lives there, and the day is
 * an open weekday. New bookings must also fall between today and the
 * horizon, in the Location's calendar.
 *
 * Capacity is a portal rule, checked separately by assertNotFull: staff
 * creation and approval are never blocked by it.
 */
class ValidateReservationDay
{
    /** Bookings open this many days ahead, on both surfaces. */
    public const MAX_ADVANCE_DAYS = 90;

    /**
     * @param  bool  $creating  false when re-validating an existing request on approve: the clock rules are skipped
     */
    public function validate(Amenity $amenity, Unit $unit, CarbonImmutable $reservedOn, bool $creating = true): void
    {
        if (! $amenity->is_reservable || $amenity->isDeactivated()) {
            $this->fail('amenity_id', __('This amenity does not accept reservations.'));
        }

        if ($unit->location_id !== $amenity->location_id) {
            $this->fail('unit_id', __('The unit does not belong to this location.'));
        }

        if (! $amenity->isOpenOn($reservedOn)) {
            $this->fail('reserved_on', __('The amenity is closed that day.'));
        }

        if ($creating) {
            $today = CarbonImmutable::now($amenity->location->timezone)->startOfDay();
            $day = $reservedOn->toDateString();

            if ($day < $today->toDateString()) {
                $this->fail('reserved_on', __('That day has passed.'));
            }

            if ($day > $today->addDays(self::MAX_ADVANCE_DAYS)->toDateString()) {
                $this->fail('reserved_on', __('Bookings open up to :days days ahead.', ['days' => self::MAX_ADVANCE_DAYS]));
            }
        }
    }

    /** The portal refuses a day whose approved count has reached the capacity (ADR 0043). */
    public function assertNotFull(Amenity $amenity, CarbonImmutable $reservedOn): void
    {
        if ($amenity->daily_capacity === null) {
            return;
        }

        if ($amenity->approvedCountOn($reservedOn->toDateString()) >= $amenity->daily_capacity) {
            $this->fail('date', __('That day is full.'));
        }
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
