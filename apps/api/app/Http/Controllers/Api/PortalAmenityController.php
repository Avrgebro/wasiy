<?php

namespace App\Http\Controllers\Api;

use App\Actions\Reservations\ValidateReservationSlot;
use App\Http\Controllers\Controller;
use App\Http\Resources\AmenityResource;
use App\Models\Amenity;
use App\Models\Unit;
use App\Services\SettingsResolver;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Resident-facing amenities (portal P2): what can be booked in my location,
 * and which slots are free on a given day. A slot is min_duration_minutes
 * long (60 when unset) laid on the availability windows; each one runs
 * through the same validator staff bookings use, so the portal never offers
 * a time the API would refuse.
 */
class PortalAmenityController extends Controller
{
    public function __construct(
        private readonly SettingsResolver $settings,
        private readonly ValidateReservationSlot $validator,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate(['unit_id' => ['required', 'string', 'ulid']]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAnyAsResident', [Amenity::class, $unit->location]);

        $amenities = Amenity::query()
            ->where('location_id', $unit->location_id)
            ->whereNull('deactivated_at')
            ->where('is_reservable', true)
            ->with('photos')
            ->orderBy('name')
            ->get();

        return AmenityResource::collection($amenities);
    }

    /** Free and taken slots for one day, in the location's timezone. */
    public function availability(Request $request, Amenity $amenity): JsonResponse
    {
        $validated = $request->validate([
            'unit_id' => ['required', 'string', 'ulid'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAnyAsResident', [Amenity::class, $amenity->location]);
        abort_unless($unit->location_id === $amenity->location_id, 404);

        $timezone = $amenity->location->timezone;
        $now = CarbonImmutable::now($timezone);
        $day = CarbonImmutable::createFromFormat('Y-m-d', $validated['date'], $timezone)->startOfDay();
        $policy = $this->settings->bookingPolicyFor($amenity);
        $maxAdvance = $policy['max_advance_days']['value'] ?? null;

        if ($day->lt($now->startOfDay())) {
            throw ValidationException::withMessages(['date' => __('That day has passed.')]);
        }
        if ($maxAdvance !== null && $day->gt($now->startOfDay()->addDays($maxAdvance))) {
            throw ValidationException::withMessages(['date' => __('Bookings open up to :days days ahead.', ['days' => $maxAdvance])]);
        }

        $slotMinutes = $amenity->min_duration_minutes ?? 60;
        $slots = [];
        foreach ($amenity->availability_schedule->windowsFor(strtolower($day->englishDayOfWeek)) as $window) {
            $cursor = $day->setTimeFromTimeString($window['start']);
            $close = $window['end'] === '24:00' ? $day->addDay() : $day->setTimeFromTimeString($window['end']);
            while ($cursor->addMinutes($slotMinutes)->lte($close)) {
                $end = $cursor->addMinutes($slotMinutes);
                $slots[] = $this->slot($amenity, $unit, $cursor, $end, $now);
                $cursor = $end;
            }
        }

        return response()->json([
            'date' => $validated['date'],
            'slot_minutes' => $slotMinutes,
            'booking_mode' => $amenity->booking_mode->value,
            'fee_amount' => $amenity->fee_amount,
            'deposit_amount' => $amenity->deposit_amount,
            'slots' => $slots,
        ]);
    }

    /**
     * @return array{start: string, end: string, available: bool, reason: string|null}
     */
    private function slot(Amenity $amenity, Unit $unit, CarbonImmutable $start, CarbonImmutable $end, CarbonImmutable $now): array
    {
        $row = ['start' => $start->format('H:i'), 'end' => $end->format('H:i'), 'available' => true, 'reason' => null];

        if ($start->lte($now)) {
            return [...$row, 'available' => false, 'reason' => 'past'];
        }

        try {
            $this->validator->validate($amenity, $unit, $start->utc(), $end->utc());
        } catch (ValidationException $exception) {
            $field = array_key_first($exception->errors());

            return [...$row, 'available' => false, 'reason' => $field === 'unit_id' ? 'unit_limit' : 'taken'];
        }

        return $row;
    }
}
