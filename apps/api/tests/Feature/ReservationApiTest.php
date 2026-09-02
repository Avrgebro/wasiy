<?php

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

test('duration limits are enforced', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'min_duration_minutes' => 60,
        'max_duration_minutes' => 120,
    ]);

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '10:30',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ends_at');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '13:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ends_at');
});

test('a null capacity means exclusive use and the buffer widens the collision', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'capacity' => null,
        'buffer_minutes' => 30,
    ]);

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '12:00',
        ]))
        ->assertCreated();

    // 12:00–13:00 would be fine without the 30-minute buffer.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '12:00', 'end' => '13:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    // Past the buffer it books.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '12:30', 'end' => '13:30',
        ]))
        ->assertCreated();
});

test('capacity above one allows that many overlapping approved bookings', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['capacity' => 2]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $thirdUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit))
        ->assertCreated();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $thirdUnit))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');
});

test('the per-unit simultaneous cap is enforced', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'capacity' => 10,
        'max_concurrent_per_unit' => 1,
    ]);

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated();

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '11:00', 'end' => '13:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_id');
});

test('pending requests never hold capacity', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
        'capacity' => null,
    ]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated();

    // Same slot, second request: also accepted as pending.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit))
        ->assertCreated();
});

test('approving revalidates capacity so the second overlapping request loses', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
        'capacity' => null,
    ]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $first = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->json('data.id');
    $second = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit))
        ->json('data.id');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$first}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$second}/approve")
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

test('front desk can create but only managers decide', function () {
    [$account, $location, $amenity, $unit] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
    ]);

    $frontDesk = User::factory()->create();
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $id = $this->actingAs($frontDesk)
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

test('the cancellation window blocks managers but not admins', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Instant,
        'cancellation_window_hours' => 48,
        'availability' => [
            'monday' => [['start' => '00:00', 'end' => '23:59']],
            'tuesday' => [['start' => '00:00', 'end' => '23:59']],
            'wednesday' => [['start' => '00:00', 'end' => '23:59']],
            'thursday' => [['start' => '00:00', 'end' => '23:59']],
            'friday' => [['start' => '00:00', 'end' => '23:59']],
            'saturday' => [['start' => '00:00', 'end' => '23:59']],
            'sunday' => [['start' => '00:00', 'end' => '23:59']],
        ],
    ]);

    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    // Tomorrow: inside the 48-hour window.
    $tomorrow = CarbonImmutable::now('America/Lima')->addDay()->format('Y-m-d');
    $inside = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => $tomorrow, 'start' => '10:00', 'end' => '11:00',
        ]))
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/reservations/{$inside}/cancel")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    // Ten days out: outside the window, the manager may cancel.
    $farOut = CarbonImmutable::now('America/Lima')->addDays(10)->format('Y-m-d');
    $outside = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => $farOut, 'start' => '10:00', 'end' => '11:00',
        ]))
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/reservations/{$outside}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    // The admin bypasses the window entirely.
    $insideForAdmin = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'date' => $tomorrow, 'start' => '12:00', 'end' => '13:00',
        ]))
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$insideForAdmin}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');
});

test('times must align to 30-minute blocks', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld();

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:03', 'end' => '11:00',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:00', 'end' => '11:47',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ends_at');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '10:30', 'end' => '11:30',
        ]))
        ->assertCreated();
});

test('capacity counts true peak concurrency, not every overlap of the request', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['capacity' => 2]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $thirdUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    // Two back-to-back bookings: they overlap a 13:00–15:00 request but
    // never each other, so the long booking still fits under capacity 2.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, [
            'start' => '13:00', 'end' => '14:00',
        ]))
        ->assertCreated();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit, [
            'start' => '14:00', 'end' => '15:00',
        ]))
        ->assertCreated();

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $thirdUnit, [
            'start' => '13:00', 'end' => '15:00',
        ]))
        ->assertCreated();

    // Now 13:00–14:00 truly runs at capacity (2 concurrent): a fourth
    // booking touching that hour is rejected.
    $fourthUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $fourthUnit, [
            'start' => '13:30', 'end' => '14:30',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('starts_at');
});
