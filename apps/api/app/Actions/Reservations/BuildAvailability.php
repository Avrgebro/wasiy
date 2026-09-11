<?php

namespace App\Actions\Reservations;

use App\Models\Amenity;
use App\Models\Reservation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * The slot list for one amenity and one local day, the only place slots are
 * computed (ADR 0041). Each availability window is cut into consecutive
 * slots of `slot_minutes` from its start; a tail shorter than a slot is not
 * offered. A booking is exactly one of these slots. Staff and portal read
 * the same list and post what it offered.
 */
class BuildAvailability
{
    /**
     * @return array{
     *     date: string,
     *     slot_minutes: int,
     *     booking_mode: string,
     *     fee_amount: int|null,
     *     deposit_amount: int|null,
     *     slots: list<array{start: string, end: string, available: bool, reason: 'past'|'taken'|null}>
     * }
     */
    public function handle(Amenity $amenity, string $date): array
    {
        $timezone = $amenity->location->timezone;
        $now = CarbonImmutable::now($timezone);
        $day = CarbonImmutable::createFromFormat('Y-m-d', $date, $timezone)->startOfDay();

        if ($day->lt($now->startOfDay())) {
            throw ValidationException::withMessages(['date' => __('That day has passed.')]);
        }
        if ($day->gt($now->startOfDay()->addDays(ValidateReservationSlot::MAX_ADVANCE_DAYS))) {
            throw ValidationException::withMessages(['date' => __('Bookings open up to :days days ahead.', ['days' => ValidateReservationSlot::MAX_ADVANCE_DAYS])]);
        }

        $slotMinutes = $amenity->slotMinutes();

        // One query for the day; the overlap test per slot is then in memory.
        $approved = Reservation::query()
            ->where('amenity_id', $amenity->id)
            ->holdingCapacity()
            ->overlapping($day->utc(), $day->addDay()->utc())
            ->get(['starts_at', 'ends_at']);

        // Step in wall-clock minutes, not elapsed time: on a daylight-saving
        // day adding 60 real minutes would repeat or skip a label.
        $slots = [];
        foreach ($amenity->availability_schedule->windowsFor(strtolower($day->englishDayOfWeek)) as $window) {
            $open = ValidateReservationSlot::minutes($window['start']);
            $close = ValidateReservationSlot::minutes($window['end']);

            for ($minute = $open; $minute + $slotMinutes <= $close; $minute += $slotMinutes) {
                $slots[] = $this->slot(
                    $day->setTime(intdiv($minute, 60), $minute % 60),
                    $day->setTime(intdiv($minute + $slotMinutes, 60), ($minute + $slotMinutes) % 60),
                    $now,
                    $approved,
                );
            }
        }

        return [
            'date' => $date,
            'slot_minutes' => $slotMinutes,
            'booking_mode' => $amenity->booking_mode->value,
            'fee_amount' => $amenity->fee_amount,
            'deposit_amount' => $amenity->deposit_amount,
            'slots' => $slots,
        ];
    }

    /**
     * @param  Collection<int, Reservation>  $approved
     * @return array{start: string, end: string, available: bool, reason: 'past'|'taken'|null}
     */
    private function slot(CarbonImmutable $start, CarbonImmutable $end, CarbonImmutable $now, $approved): array
    {
        $row = ['start' => $start->format('H:i'), 'end' => $end->format('H:i'), 'available' => true, 'reason' => null];

        if ($start->lte($now)) {
            return [...$row, 'available' => false, 'reason' => 'past'];
        }

        $taken = $approved->contains(
            fn (Reservation $reservation): bool => $reservation->starts_at < $end && $reservation->ends_at > $start,
        );

        return $taken ? [...$row, 'available' => false, 'reason' => 'taken'] : $row;
    }
}
