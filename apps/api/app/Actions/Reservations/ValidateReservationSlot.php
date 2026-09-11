<?php

namespace App\Actions\Reservations;

use App\Models\Amenity;
use App\Models\Reservation;
use App\Models\Unit;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * The booking rule (ADR 0041), shared by create and approve so both paths
 * agree: the amenity accepts bookings, the unit lives there, the interval is
 * a run of whole slots inside one availability window of that local
 * weekday, it starts in the future and within the horizon (new bookings
 * only), and no approved reservation of the amenity overlaps it. Pending and
 * observed requests never block; the approver resolves contention.
 *
 * The caller runs this inside the transaction that locks the Amenity row.
 */
class ValidateReservationSlot
{
    /** Bookings open this many days ahead, on both surfaces. */
    public const MAX_ADVANCE_DAYS = 90;

    public function validate(
        Amenity $amenity,
        Unit $unit,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
        ?Reservation $ignore = null,
    ): void {
        if (! $amenity->is_reservable || $amenity->isDeactivated()) {
            $this->fail('amenity_id', __('This amenity does not accept reservations.'));
        }

        if ($unit->location_id !== $amenity->location_id) {
            $this->fail('unit_id', __('The unit does not belong to this location.'));
        }

        $timezone = $amenity->location->timezone;
        $localStart = $startsAt->setTimezone($timezone);
        $localEnd = $endsAt->setTimezone($timezone);

        if ($localEnd <= $localStart) {
            $this->fail('ends_at', __('The reservation must end after it starts.'));
        }

        // Re-validating an existing request on approve skips the clock rules:
        // the slot itself is what must still be free.
        if ($ignore === null) {
            $now = CarbonImmutable::now($timezone);

            if ($localStart <= $now) {
                $this->fail('starts_at', __('That time has passed.'));
            }

            if ($localStart->startOfDay() > $now->startOfDay()->addDays(self::MAX_ADVANCE_DAYS)) {
                $this->fail('starts_at', __('Bookings open up to :days days ahead.', ['days' => self::MAX_ADVANCE_DAYS]));
            }
        }

        $this->validateSlotGrid($amenity, $localStart, $localEnd);
        $this->validateExclusive($amenity, $startsAt, $endsAt, $ignore);
    }

    /**
     * The interval must sit inside one window of the local weekday and be
     * aligned to that window's slot grid: it starts a whole number of slots
     * after the window opens and lasts a whole number of slots.
     */
    private function validateSlotGrid(Amenity $amenity, CarbonImmutable $localStart, CarbonImmutable $localEnd): void
    {
        if (! $localStart->isSameDay($localEnd)) {
            $this->fail('starts_at', __('The requested time falls outside the amenity availability.'));
        }

        $slot = $amenity->slotMinutes();
        $startMinute = $localStart->hour * 60 + $localStart->minute;
        $endMinute = $localEnd->hour * 60 + $localEnd->minute;
        $weekday = strtolower($localStart->englishDayOfWeek);

        foreach ($amenity->availability_schedule->windowsFor($weekday) as $window) {
            $open = self::minutes($window['start']);
            $close = self::minutes($window['end']);

            if ($startMinute < $open || $endMinute > $close) {
                continue;
            }

            if (($startMinute - $open) % $slot !== 0 || ($endMinute - $startMinute) % $slot !== 0) {
                $this->fail('starts_at', __('Reservations follow the amenity slots of :minutes minutes.', ['minutes' => $slot]));
            }

            return;
        }

        $this->fail('starts_at', __('The requested time falls outside the amenity availability.'));
    }

    /** Only approved bookings hold the amenity; back-to-back bookings do not collide. */
    private function validateExclusive(
        Amenity $amenity,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
        ?Reservation $ignore,
    ): void {
        $taken = Reservation::query()
            ->where('amenity_id', $amenity->id)
            ->holdingCapacity()
            ->overlapping($startsAt, $endsAt)
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
            ->exists();

        if ($taken) {
            $this->fail('starts_at', __('The amenity is already booked for this time.'));
        }
    }

    public static function minutes(string $time): int
    {
        [$hours, $minutes] = explode(':', $time);

        return (int) $hours * 60 + (int) $minutes;
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
