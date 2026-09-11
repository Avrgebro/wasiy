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
        'fee_amount' => 150,
        'deposit_amount' => 300,
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
        'end' => '12:00',
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
        ->assertJsonPath('data.fee_snapshot', 150)
        ->assertJsonPath('data.deposit_snapshot', 300)
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

test('bookings follow the slot grid of the window they fall in', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['slot_minutes' => 60]);

    // Off the grid: the window opens at 09:00, so 10:30 is half a slot in.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:30', 'end' => '11:30',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // Not a whole number of slots.
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
});

test('only approved bookings hold the slot: pending never blocks, approving revalidates', function () {
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

    // The slot is now held: the second request cannot be approved, and a new
    // instant booking overlapping it is refused. Back-to-back still books.
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$second}/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    $amenity->forceFill(['booking_mode' => BookingMode::Instant])->save();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit, [
            'start' => '11:00', 'end' => '13:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit, [
            'start' => '12:00', 'end' => '13:00',
        ]))
        ->assertCreated();
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
        ->assertJsonPath('fee_amount', 150)
        ->assertJsonCount(1, 'slots')
        ->assertJsonPath('slots.0', ['start' => '09:00', 'end' => '11:00', 'available' => true, 'reason' => null]);

    // Monday 09:00–22:00 with an approved 13:00–15:00 booking: six slots, one taken.
    $monday = nextMonday();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['start' => '13:00', 'end' => '15:00']))
        ->assertCreated();

    $slots = collect($this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?date={$monday}&unit_id={$unit->id}")
        ->assertOk()
        ->assertJsonCount(6, 'slots')
        ->json('slots'))->keyBy('start');

    expect($slots['13:00']['reason'])->toBe('taken')
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

    // 04:00–06:00 local is after the fall-back: 03:00–05:00 UTC.
    $response = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), [
            'amenity_id' => $amenity->id, 'unit_id' => $unit->id,
            'date' => '2026-10-25', 'start' => '04:00', 'end' => '06:00',
        ])
        ->assertCreated();

    expect($response->json('data.starts_at'))->toBe(CarbonImmutable::parse('2026-10-25 03:00', 'UTC')->toJSON())
        ->and($response->json('data.ends_at'))->toBe(CarbonImmutable::parse('2026-10-25 05:00', 'UTC')->toJSON());

    // The taken slots carry the same labels.
    $after = collect($this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?date=2026-10-25")
        ->json('slots'))->keyBy('start');
    expect($after['04:00']['reason'])->toBe('taken')
        ->and($after['05:00']['reason'])->toBe('taken')
        ->and($after['03:00']['available'])->toBeTrue();
});
