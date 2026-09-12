<?php

namespace App\Actions\Reservations;

use App\Enums\ReservationStatus;
use App\Models\Amenity;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * The day list for one amenity over a date range (ADR 0043), read by the
 * staff drawer and the portal day strip alike. A day is unavailable when it
 * has passed (`past`, in the Location's calendar), when the amenity does not
 * open on that weekday (`closed`), or when the approved bookings have
 * reached `daily_capacity` (`full`). `full` is reported on both surfaces;
 * only the portal enforces it.
 */
class BuildAvailability
{
    /**
     * @return array{
     *     days: list<array{date: string, available: bool, reason: 'closed'|'past'|'full'|null, approved_count: int}>,
     *     daily_capacity: int|null,
     *     booking_mode: string,
     *     fee_amount_minor: int|null,
     *     deposit_amount_minor: int|null
     * }
     */
    public function handle(Amenity $amenity, string $from, string $to): array
    {
        $timezone = $amenity->location->timezone;
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $start = CarbonImmutable::createFromFormat('Y-m-d', $from, $timezone)->startOfDay();
        $end = CarbonImmutable::createFromFormat('Y-m-d', $to, $timezone)->startOfDay();

        if ($end->lt($start)) {
            throw ValidationException::withMessages(['to' => __('The range must end on or after the day it starts.')]);
        }
        if ($start->diffInDays($end) > ValidateReservationDay::MAX_ADVANCE_DAYS) {
            throw ValidationException::withMessages(['to' => __('The range covers at most :days days.', ['days' => ValidateReservationDay::MAX_ADVANCE_DAYS])]);
        }

        $approved = $amenity->reservations()
            ->where('status', ReservationStatus::Approved->value)
            ->whereBetween('reserved_on', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('reserved_on, count(*) as total')
            ->groupBy('reserved_on')
            ->pluck('total', 'reserved_on')
            ->mapWithKeys(fn (mixed $total, mixed $date): array => [substr((string) $date, 0, 10) => (int) $total]);

        $days = [];
        for ($day = $start; $day->lte($end); $day = $day->addDay()) {
            $date = $day->toDateString();
            $count = $approved->get($date, 0);

            $reason = match (true) {
                $day->lt($today) => 'past',
                ! $amenity->isOpenOn($day) => 'closed',
                $amenity->daily_capacity !== null && $count >= $amenity->daily_capacity => 'full',
                default => null,
            };

            $days[] = ['date' => $date, 'available' => $reason === null, 'reason' => $reason, 'approved_count' => $count];
        }

        return [
            'days' => $days,
            'daily_capacity' => $amenity->daily_capacity,
            'booking_mode' => $amenity->booking_mode->value,
            'fee_amount_minor' => $amenity->fee_amount_minor,
            'deposit_amount_minor' => $amenity->deposit_amount_minor,
        ];
    }
}
