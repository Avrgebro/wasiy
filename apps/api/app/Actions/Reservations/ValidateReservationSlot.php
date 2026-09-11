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
 * a run of one or more consecutive slots of one availability window of that
 * local weekday, and it starts in the future and within the horizon (new
 * bookings only).
 *
 * Slots are not exclusive: any number of units may hold the same slot in
 * any status. Overlap is never checked here; the approver sees the clash on
 * the day board and resolves it by observing, rejecting or cancelling.
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
        // only the amenity and the slot grid must still hold.
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
    }

    /**
     * The interval must be a run of whole slots of one window of the local
     * weekday: it starts on that window's grid (window start, stepping
     * `slot_minutes`), its length is a positive whole multiple of
     * `slot_minutes`, and it ends at or before the window closes. Slots are
     * not exclusive, so the closing time is the only cap on the run. A tail
     * shorter than a slot is never a slot.
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

            if ($startMinute < $open || $startMinute >= $close) {
                continue;
            }

            if (($startMinute - $open) % $slot !== 0 || $startMinute + $slot > $close) {
                $this->fail('starts_at', __('The requested time falls outside the amenity availability.'));
            }

            if (($endMinute - $startMinute) % $slot !== 0 || $endMinute > $close) {
                $this->fail('starts_at', __('A reservation covers whole slots of :minutes minutes inside the opening hours.', ['minutes' => $slot]));
            }

            return;
        }

        $this->fail('starts_at', __('The requested time falls outside the amenity availability.'));
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
