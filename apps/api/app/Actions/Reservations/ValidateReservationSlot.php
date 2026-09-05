<?php

namespace App\Actions\Reservations;

use App\Models\Amenity;
use App\Models\Reservation;
use App\Models\Unit;
use App\Services\SettingsResolver;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * The booking rule, shared by create and approve so both paths agree. All
 * wall-clock comparisons happen in the Location's timezone; the caller is
 * responsible for running inside the transaction that locks the Amenity row.
 */
class ValidateReservationSlot
{
    public function __construct(
        private readonly SettingsResolver $settings,
    ) {}

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

        if (! $localStart->isSameDay($localEnd)) {
            $this->fail('ends_at', __('A reservation must start and end on the same day.'));
        }

        // One global grid for every amenity: bookings start and end on the
        // half hour. Enforced here (not only in the pickers) so any client
        // meets the same wall.
        if ((int) $localStart->format('i') % 30 !== 0) {
            $this->fail('starts_at', __('Reservations must start on a 30-minute block.'));
        }

        if ((int) $localEnd->format('i') % 30 !== 0) {
            $this->fail('ends_at', __('Reservations must end on a 30-minute block.'));
        }

        $this->validateWindow($amenity, $localStart, $localEnd);
        $this->validateDuration($amenity, $localStart, $localEnd);
        $this->validateCapacity($amenity, $startsAt, $endsAt, $ignore);
        $this->validatePerUnit($amenity, $unit, $startsAt, $endsAt, $ignore);
    }

    private function validateWindow(Amenity $amenity, CarbonImmutable $localStart, CarbonImmutable $localEnd): void
    {
        $weekday = strtolower($localStart->englishDayOfWeek);
        $start = $localStart->format('H:i');
        // 24:00 for a booking that runs to midnight, so it can still fit a
        // window closing at end of day.
        $end = $localEnd->isSameDay($localStart) ? $localEnd->format('H:i') : '24:00';

        foreach ($amenity->availability_schedule->windowsFor($weekday) as $window) {
            if ($start >= $window['start'] && $end <= $window['end']) {
                return;
            }
        }

        $this->fail('starts_at', __('The requested time falls outside the amenity availability.'));
    }

    private function validateDuration(Amenity $amenity, CarbonImmutable $localStart, CarbonImmutable $localEnd): void
    {
        $minutes = $localStart->diffInMinutes($localEnd);

        if ($amenity->min_duration_minutes !== null && $minutes < $amenity->min_duration_minutes) {
            $this->fail('ends_at', __('The reservation is shorter than the minimum duration.'));
        }

        if ($amenity->max_duration_minutes !== null && $minutes > $amenity->max_duration_minutes) {
            $this->fail('ends_at', __('The reservation exceeds the maximum duration.'));
        }
    }

    /**
     * At no instant inside the requested interval (padded by the buffer) may
     * the number of approved reservations reach capacity. A sweep over the
     * clipped intervals gives the true peak: two bookings that overlap the
     * request but not each other only ever count as one at a time. A null
     * capacity means exclusive use (one at a time).
     */
    private function validateCapacity(
        Amenity $amenity,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
        ?Reservation $ignore,
    ): void {
        $buffer = $amenity->buffer_minutes ?? 0;
        $capacity = $amenity->capacity ?? 1;
        $from = $startsAt->subMinutes($buffer);
        $to = $endsAt->addMinutes($buffer);

        $overlapping = Reservation::query()
            ->where('amenity_id', $amenity->id)
            ->holdingCapacity()
            ->overlapping($from, $to)
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
            ->get(['starts_at', 'ends_at']);

        /** @var array<int, array{int, int}> $events */
        $events = [];
        foreach ($overlapping as $reservation) {
            $events[] = [max($reservation->starts_at->getTimestamp(), $from->getTimestamp()), 1];
            $events[] = [min($reservation->ends_at->getTimestamp(), $to->getTimestamp()), -1];
        }

        // Ends sort before starts at the same instant: back-to-back bookings
        // are not concurrent.
        usort($events, fn (array $a, array $b): int => [$a[0], $a[1]] <=> [$b[0], $b[1]]);

        $current = 0;
        $peak = 0;
        foreach ($events as [, $delta]) {
            $current += $delta;
            $peak = max($peak, $current);
        }

        if ($peak + 1 > $capacity) {
            $this->fail('starts_at', __('The amenity is fully booked for this time.'));
        }
    }

    private function validatePerUnit(
        Amenity $amenity,
        Unit $unit,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
        ?Reservation $ignore,
    ): void {
        $policy = $this->settings->bookingPolicyFor($amenity);
        $maxPerUnit = $policy['max_concurrent_per_unit']['value'] ?? null;

        if ($maxPerUnit === null) {
            return;
        }

        $overlapping = Reservation::query()
            ->where('unit_id', $unit->id)
            ->where('location_id', $amenity->location_id)
            ->holdingCapacity()
            ->overlapping($startsAt, $endsAt)
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
            ->count();

        if ($overlapping >= $maxPerUnit) {
            $this->fail('unit_id', __('The unit already has the maximum simultaneous reservations.'));
        }
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
