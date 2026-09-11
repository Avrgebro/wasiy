<?php

use App\Actions\Reservations\ValidateReservationSlot;
use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\BookingMode;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Account, Location, Amenity, Unit, User}
 */
function reservationWorld(array $amenityOverrides = []): array
{
    $account = Account::factory()->create();
    // America/Lima (UTC−5) so a UTC-boundary bug shows up in wall-clock
    // assertions.
    $location = Location::factory()->for($account)->create(['timezone' => 'America/Lima']);
    $amenity = Amenity::factory()->for($location)->create([
        'account_id' => $account->id,
        'availability' => [
            'monday' => [['start' => '09:00', 'end' => '22:00']],
            'tuesday' => [['start' => '09:00', 'end' => '12:00']],
        ],
        'fee_amount_minor' => 150,
        'deposit_amount_minor' => 300,
        ...$amenityOverrides,
    ]);
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return [$account, $location, $amenity, $unit, $admin];
}

function reservationsBase(Account $account, Location $location): string
{
    return "/api/accounts/{$account->id}/locations/{$location->id}/reservations";
}

/** The next Monday strictly in the future, as a local Lima date string. */
function nextMonday(): string
{
    return CarbonImmutable::now('America/Lima')->addWeek()->next('Monday')->format('Y-m-d');
}

function reservationPayload(Amenity $amenity, Unit $unit, array $overrides = []): array
{
    return [
        'amenity_id' => $amenity->id,
        'unit_id' => $unit->id,
        'date' => nextMonday(),
        'start' => '10:00',
        'end' => '11:00',
        ...$overrides,
    ];
}

test('an instant amenity books as approved with fee snapshots and an activity entry', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Instant,
    ]);

    $response = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'approved')
        ->assertJsonPath('data.fee_snapshot_minor', 150)
        ->assertJsonPath('data.deposit_snapshot_minor', 300)
        ->assertJsonPath('data.unit_number', $unit->unit_number);

    // 10:00 in Lima is 15:00 UTC — stored UTC, validated wall-clock.
    expect($response->json('data.starts_at'))->toBe(
        CarbonImmutable::parse(nextMonday().' 10:00', 'America/Lima')->utc()->toJSON(),
    );

    expect(ActivityLog::query()
        ->where('event_type', ActivityEventType::ReservationCreated->value)
        ->where('subject_id', $response->json('data.id'))
        ->exists())->toBeTrue();
});

test('an approval amenity books as pending', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
    ]);

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');
});

test('a slot outside the availability windows is rejected', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld();

    // Tuesday closes at 12:00.
    $tuesday = CarbonImmutable::parse(nextMonday())->addDay()->format('Y-m-d');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => $tuesday,
            'start' => '11:00',
            'end' => '13:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // Wednesday is closed entirely.
    $wednesday = CarbonImmutable::parse(nextMonday())->addDays(2)->format('Y-m-d');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => $wednesday,
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');
});

test('reject and observe require a note; observed requests stay decidable', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
    ]);

    $id = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->json('data.id');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$id}/observe")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('note');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$id}/observe", ['note' => 'Falta pagar el depósito.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'observed')
        ->assertJsonPath('data.status_note', 'Falta pagar el depósito.');

    // Observed is still open: it can be approved afterwards.
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$id}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');
});

test('an approved reservation can be cancelled; a rejected one cannot', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
    ]);

    $approved = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->json('data.id');
    $this->actingAs($admin)->postJson("/api/accounts/{$account->id}/reservations/{$approved}/approve");
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$approved}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    $rejected = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '13:00', 'end' => '14:00',
        ]))
        ->json('data.id');
    $this->actingAs($admin)->postJson("/api/accounts/{$account->id}/reservations/{$rejected}/reject", ['note' => 'No procede.']);
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$rejected}/cancel")
        ->assertUnprocessable();
});

test('the list filters by local date range and status set', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld();

    $monday = nextMonday();
    $tuesday = CarbonImmutable::parse($monday)->addDay()->format('Y-m-d');

    $this->actingAs($admin)->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
        'date' => $monday, 'start' => '09:00', 'end' => '10:00',
    ]))->assertCreated();
    $this->actingAs($admin)->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
        'date' => $tuesday, 'start' => '09:00', 'end' => '10:00',
    ]))->assertCreated();

    $this->actingAs($admin)
        ->getJson(reservationsBase($account, $location)."?from={$monday}&to={$monday}")
        ->assertOk()
        ->assertJsonCount(1, 'data');

    $this->actingAs($admin)
        ->getJson(reservationsBase($account, $location).'?status=pending,observed')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->actingAs($admin)
        ->getJson(reservationsBase($account, $location).'?status=approved')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('front desk reads reservations but neither creates nor decides', function () {
    [$account, $location, $amenity, $unit] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
    ]);

    $frontDesk = User::factory()->create();
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $this->actingAs($frontDesk)
        ->getJson(reservationsBase($account, $location))
        ->assertOk();

    $this->actingAs($frontDesk)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertForbidden();

    $id = $this->actingAs($manager)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($frontDesk)
        ->postJson("/api/accounts/{$account->id}/reservations/{$id}/approve")
        ->assertForbidden();

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/reservations/{$id}/approve")
        ->assertOk();
});

test('a deactivated or non-reservable amenity refuses bookings', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld();

    $amenity->deactivate();

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('amenity_id');

    $amenity->reactivate();
    $amenity->forceFill(['is_reservable' => false])->save();

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('amenity_id');
});

test('a staff member of another location cannot list or create', function () {
    [$account, $location, $amenity, $unit] = reservationWorld();
    $otherLocation = Location::factory()->for($account)->create();

    $outsider = User::factory()->create();
    grantLocationRole($account, $otherLocation, $outsider, LocationRole::LocationManager);

    $this->actingAs($outsider)
        ->getJson(reservationsBase($account, $location))
        ->assertForbidden();

    $this->actingAs($outsider)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertForbidden();
});

function everyDayOpen(): array
{
    return collect(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
        ->mapWithKeys(fn (string $day) => [$day => [['start' => '00:00', 'end' => '23:30']]])
        ->all();
}

test('a booking is a run of whole slots inside the window it falls in', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['slot_minutes' => 60]);

    // Off the grid: the window opens at 09:00, so 10:30 is half a slot in.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:30', 'end' => '11:30',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // Shorter than a slot.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '10:30',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // Not a whole number of slots: 90 minutes on a 60-minute grid.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '11:30',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // Two consecutive slots are one booking.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '12:00',
        ]))
        ->assertCreated();

    // So are three.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '14:00', 'end' => '17:00',
        ]))
        ->assertCreated()
        ->assertJsonPath('data.starts_at', CarbonImmutable::parse(nextMonday().' 14:00', 'America/Lima')->utc()->toJSON())
        ->assertJsonPath('data.ends_at', CarbonImmutable::parse(nextMonday().' 17:00', 'America/Lima')->utc()->toJSON());

    // A run that crosses the window close (22:00) is refused, even though it starts on the grid.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '20:00', 'end' => '23:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // The same start as a single slot books.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '11:00',
        ]))
        ->assertCreated();

    // The last slot ends exactly at the window close; a slot starting there does not exist.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '21:00', 'end' => '22:00',
        ]))
        ->assertCreated();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '22:00', 'end' => '23:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');
});

test('slots are not exclusive: several units may request the same slot and each may be approved', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
    ]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $first = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->json('data.id');
    // Same slot, second request: accepted as pending.
    $second = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit))
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$first}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    // An approved booking holds nothing: the second request is still
    // approvable, and a third unit may still book the slot instantly. The
    // clash is the approver's to see and resolve.
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$second}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    $thirdUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $amenity->forceFill(['booking_mode' => BookingMode::Instant])->save();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $thirdUnit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'approved');

    // Approving still re-checks the amenity itself.
    $late = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['start' => '11:00', 'end' => '12:00']))
        ->assertCreated()
        ->json('data.id');
    $amenity->forceFill(['booking_mode' => BookingMode::Approval, 'is_reservable' => false])->save();
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$late}/approve")
        ->assertUnprocessable();
});

test('two units book the same slot of an instant amenity and both end up approved', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Instant,
    ]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $first = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'approved')
        ->json('data');
    $second = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'approved')
        ->json('data');

    expect($second['starts_at'])->toBe($first['starts_at'])
        ->and($second['ends_at'])->toBe($first['ends_at'])
        ->and($second['id'])->not->toBe($first['id']);

    $this->actingAs($admin)
        ->getJson(reservationsBase($account, $location).'?status=approved')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('a booking must start in the future and within the 90-day horizon, on the staff surface too', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['availability' => everyDayOpen()]);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 15:00', 'America/Lima')->utc());

    // Earlier today.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => '2026-10-05', 'start' => '10:00', 'end' => '11:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // Later today books.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => '2026-10-05', 'start' => '16:00', 'end' => '17:00',
        ]))
        ->assertCreated();

    $horizon = CarbonImmutable::parse('2026-10-05', 'America/Lima')->addDays(ValidateReservationSlot::MAX_ADVANCE_DAYS);
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => $horizon->format('Y-m-d'), 'start' => '10:00', 'end' => '11:00',
        ]))
        ->assertCreated();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => $horizon->addDay()->format('Y-m-d'), 'start' => '10:00', 'end' => '11:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');
});

test('staff may cancel a booking after it has started', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Instant,
    ]);
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $monday = nextMonday();
    $id = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->json('data.id');

    $this->travelTo(CarbonImmutable::parse("{$monday} 10:30", 'America/Lima')->utc());

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/reservations/{$id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');
});

test('the staff availability endpoint lists the slots and drops a tail shorter than a slot', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['slot_minutes' => 120]);
    $frontDesk = User::factory()->create();
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);

    // Tuesday runs 09:00–12:00: one two-hour slot fits, the last hour is not offered.
    $tuesday = CarbonImmutable::parse(nextMonday())->addDay()->format('Y-m-d');

    $this->actingAs($frontDesk)
        ->getJson("/api/amenities/{$amenity->id}/availability?date={$tuesday}")
        ->assertOk()
        ->assertJsonPath('slot_minutes', 120)
        ->assertJsonPath('fee_amount_minor', 150)
        ->assertJsonCount(1, 'slots')
        ->assertJsonPath('slots.0', ['start' => '09:00', 'end' => '11:00', 'available' => true, 'reason' => null, 'max_slots' => 1]);

    // Monday 09:00–22:00 with an approved 13:00–15:00 booking: six slots, all
    // still offered, since a booking holds nothing.
    $monday = nextMonday();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['start' => '13:00', 'end' => '15:00']))
        ->assertCreated();

    $slots = collect($this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?date={$monday}&unit_id={$unit->id}")
        ->assertOk()
        ->assertJsonCount(6, 'slots')
        ->json('slots'))->keyBy('start');

    // max_slots counts the run from each slot to the 22:00 close: 13:00 has
    // four two-hour slots ahead of it, the last slot has one.
    expect($slots['13:00'])->toBe(['start' => '13:00', 'end' => '15:00', 'available' => true, 'reason' => null, 'max_slots' => 4])
        ->and($slots['09:00']['max_slots'])->toBe(6)
        ->and($slots['19:00']['max_slots'])->toBe(1)
        ->and($slots['11:00']['available'])->toBeTrue()
        ->and($slots['19:00']['end'])->toBe('21:00');

    // Outsiders and past days are refused.
    $outsider = User::factory()->create();
    $this->actingAs($outsider)->getJson("/api/amenities/{$amenity->id}/availability?date={$monday}")->assertForbidden();
    $this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?date=".CarbonImmutable::now('America/Lima')->subDay()->toDateString())
        ->assertUnprocessable()
        ->assertJsonValidationErrors('date');
});

test('slots and bookings keep wall-clock labels across a daylight-saving transition', function () {
    // Madrid falls back on 2026-10-25: 03:00 CEST becomes 02:00 CET, a 25-hour day.
    // travelTo takes UTC instances: a zoned mock leaks its offset into how
    // Eloquent parses stored timestamps.
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create(['timezone' => 'Europe/Madrid']);
    $amenity = Amenity::factory()->for($location)->create([
        'account_id' => $account->id,
        'booking_mode' => BookingMode::Instant,
        'availability' => ['sunday' => [['start' => '00:00', 'end' => '06:00']]],
        'slot_minutes' => 60,
    ]);
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    $this->travelTo(CarbonImmutable::parse('2026-10-20 12:00', 'Europe/Madrid')->utc());

    $slots = $this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?date=2026-10-25")
        ->assertOk()
        ->assertJsonCount(6, 'slots')
        ->json('slots');

    expect(array_column($slots, 'start'))->toBe(['00:00', '01:00', '02:00', '03:00', '04:00', '05:00'])
        ->and($slots[5]['end'])->toBe('06:00');

    // 04:00–05:00 local is after the fall-back: 03:00–04:00 UTC.
    $response = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), [
            'amenity_id' => $amenity->id, 'unit_id' => $unit->id,
            'date' => '2026-10-25', 'start' => '04:00', 'end' => '05:00',
        ])
        ->assertCreated();

    expect($response->json('data.starts_at'))->toBe(CarbonImmutable::parse('2026-10-25 03:00', 'UTC')->toJSON())
        ->and($response->json('data.ends_at'))->toBe(CarbonImmutable::parse('2026-10-25 04:00', 'UTC')->toJSON());

    // The list keeps the same labels after the booking, and the booked slot
    // stays offered: bookings do not mark slots.
    $after = collect($this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?date=2026-10-25")
        ->json('slots'))->keyBy('start');
    expect($after->keys()->all())->toBe(['00:00', '01:00', '02:00', '03:00', '04:00', '05:00'])
        ->and($after['04:00'])->toBe(['start' => '04:00', 'end' => '05:00', 'available' => true, 'reason' => null, 'max_slots' => 2])
        ->and($after['05:00']['available'])->toBeTrue()
        ->and($after['03:00']['available'])->toBeTrue();

    // A second unit books the very same post-transition slot.
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), [
            'amenity_id' => $amenity->id, 'unit_id' => $secondUnit->id,
            'date' => '2026-10-25', 'start' => '04:00', 'end' => '05:00',
        ])
        ->assertCreated()
        ->assertJsonPath('data.starts_at', CarbonImmutable::parse('2026-10-25 03:00', 'UTC')->toJSON());
});
