<?php

use App\Actions\Reservations\ValidateReservationDay;
use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\BookingMode;
use App\Enums\LocationRole;
use App\Enums\Weekday;
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
    // America/Lima (UTC−5) so a UTC-boundary bug shows up in the day rules.
    $location = Location::factory()->for($account)->create(['timezone' => 'America/Lima']);
    $amenity = Amenity::factory()->for($location)->create([
        'account_id' => $account->id,
        'open_days' => ['monday', 'tuesday'],
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

/** The Monday of next week, as a local Lima date string. */
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
        ->assertJsonPath('data.reserved_on', nextMonday())
        ->assertJsonPath('data.is_completed', false)
        ->assertJsonPath('data.fee_snapshot_minor', 150)
        ->assertJsonPath('data.deposit_snapshot_minor', 300)
        ->assertJsonPath('data.unit_number', $unit->unit_number)
        ->assertJsonPath('data.building_name', $unit->building_name)
        ->assertJsonMissingPath('data.starts_at')
        ->assertJsonMissingPath('data.ends_at');

    expect(ActivityLog::query()
        ->where('event_type', ActivityEventType::ReservationCreated->value)
        ->where('subject_id', $response->json('data.id'))
        ->value('metadata'))->toMatchArray(['reserved_on' => nextMonday()]);
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

test('a closed weekday is rejected', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld();

    // Wednesday is not an open day.
    $wednesday = CarbonImmutable::parse(nextMonday())->addDays(2)->format('Y-m-d');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => $wednesday]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reserved_on');

    // Tuesday is.
    $tuesday = CarbonImmutable::parse(nextMonday())->addDay()->format('Y-m-d');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => $tuesday]))
        ->assertCreated()
        ->assertJsonPath('data.reserved_on', $tuesday);
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
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->json('data.id');
    $this->actingAs($admin)->postJson("/api/accounts/{$account->id}/reservations/{$rejected}/reject", ['note' => 'No procede.']);
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$rejected}/cancel")
        ->assertUnprocessable();
});

test('the list filters by an inclusive day range on reserved_on and by status set', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld();

    $monday = nextMonday();
    $tuesday = CarbonImmutable::parse($monday)->addDay()->format('Y-m-d');

    $this->actingAs($admin)->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => $monday]))->assertCreated();
    $this->actingAs($admin)->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => $tuesday]))->assertCreated();

    $this->actingAs($admin)
        ->getJson(reservationsBase($account, $location)."?from={$monday}&to={$monday}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.reserved_on', $monday);

    $this->actingAs($admin)
        ->getJson(reservationsBase($account, $location)."?from={$monday}&to={$tuesday}")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.reserved_on', $monday)
        ->assertJsonPath('data.1.reserved_on', $tuesday);

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

test('a booking is today or later and within the 90-day horizon, on the staff surface too', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['open_days' => Weekday::keys()]);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 15:00', 'America/Lima')->utc());

    // Yesterday.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => '2026-10-04']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reserved_on');

    // Today books, whatever the hour.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => '2026-10-05']))
        ->assertCreated()
        ->assertJsonPath('data.reserved_on', '2026-10-05');

    $horizon = CarbonImmutable::parse('2026-10-05', 'America/Lima')->addDays(ValidateReservationDay::MAX_ADVANCE_DAYS);
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => $horizon->format('Y-m-d')]))
        ->assertCreated();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => $horizon->addDay()->format('Y-m-d')]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reserved_on');
});

test('today is the location\'s today, not UTC\'s', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld(['open_days' => Weekday::keys()]);

    // 23:30 in Lima on the 5th is already 04:30 UTC on the 6th.
    $this->travelTo(CarbonImmutable::parse('2026-10-05 23:30', 'America/Lima')->utc());
    expect(now()->toDateString())->toBe('2026-10-06');

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => '2026-10-05']))
        ->assertCreated()
        ->assertJsonPath('data.reserved_on', '2026-10-05')
        ->assertJsonPath('data.is_completed', false);

    $days = collect($this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?from=2026-10-04&to=2026-10-06")
        ->assertOk()
        ->json('days'))->keyBy('date');
    expect($days['2026-10-04']['reason'])->toBe('past')
        ->and($days['2026-10-05']['available'])->toBeTrue()
        ->and($days['2026-10-06']['available'])->toBeTrue();

    // The other way round: 00:30 in Lima on the 6th is 05:30 UTC the same day, and the 5th has passed.
    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:30', 'America/Lima')->utc());
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => '2026-10-05']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reserved_on');
});

test('staff are never blocked by the daily capacity, on creation or approval', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Instant,
        'daily_capacity' => 1,
    ]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $thirdUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'approved');
    // The salón is full for the day; staff book it anyway.
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'approved');

    // A pending request on a full day may still be approved: the count is the approver's call.
    $amenity->forceFill(['booking_mode' => BookingMode::Approval])->save();
    $pending = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $thirdUnit))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->json('data.id');
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$pending}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    $monday = nextMonday();
    $this->actingAs($admin)
        ->getJson("/api/amenities/{$amenity->id}/availability?from={$monday}&to={$monday}")
        ->assertOk()
        ->assertJsonPath('daily_capacity', 1)
        ->assertJsonPath('days.0', ['date' => $monday, 'available' => false, 'reason' => 'full', 'approved_count' => 3]);
});

test('approve re-validates the amenity and the open day', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Approval,
    ]);
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $onMonday = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit))
        ->assertCreated()
        ->json('data.id');
    $another = $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $secondUnit))
        ->assertCreated()
        ->json('data.id');

    // The amenity stops opening on Mondays before the decision.
    $amenity->forceFill(['open_days' => ['tuesday']])->save();
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$onMonday}/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reserved_on');

    // Reopened, the request is approvable even though its day is now within a week (no clock rules on approve).
    $amenity->forceFill(['open_days' => ['monday']])->save();
    $this->travelTo(CarbonImmutable::parse(nextMonday(), 'America/Lima')->subDay()->setTime(12, 0)->utc());
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$onMonday}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    // An amenity that no longer takes bookings refuses the approval.
    $amenity->forceFill(['is_reservable' => false])->save();
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$another}/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('amenity_id');
});

test('staff may cancel a booking on its day and after it', function () {
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

    $this->travelTo(CarbonImmutable::parse("{$monday} 10:30", 'America/Lima')->addDays(2)->utc());

    $this->actingAs($manager)
        ->getJson("/api/accounts/{$account->id}/reservations/{$id}")
        ->assertOk()
        ->assertJsonPath('data.is_completed', true);

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/reservations/{$id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');
});

test('the staff availability endpoint lists the days of a range with their reasons and approved counts', function () {
    [$account, $location, $amenity, $unit, $admin] = reservationWorld([
        'booking_mode' => BookingMode::Instant,
        'daily_capacity' => 2,
    ]);
    $frontDesk = User::factory()->create();
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);

    // A Wednesday at noon: Monday and Tuesday of that week have passed.
    $monday = nextMonday();
    $this->travelTo(CarbonImmutable::parse("{$monday} 12:00", 'America/Lima')->addDays(2)->utc());

    $followingMonday = CarbonImmutable::parse($monday)->addWeek()->format('Y-m-d');
    $followingTuesday = CarbonImmutable::parse($monday)->addWeek()->addDay()->format('Y-m-d');
    $secondUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    foreach ([$unit, $secondUnit] as $booker) {
        $this->actingAs($admin)
            ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $booker, ['date' => $followingMonday]))
            ->assertCreated();
    }
    // A pending request never counts.
    $amenity->forceFill(['booking_mode' => BookingMode::Approval])->save();
    $this->actingAs($admin)
        ->postJson(reservationsBase($account, $location), reservationPayload($amenity, $unit, ['date' => $followingTuesday]))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');

    $response = $this->actingAs($frontDesk)
        ->getJson("/api/amenities/{$amenity->id}/availability?from={$monday}&to={$followingTuesday}")
        ->assertOk()
        ->assertJsonPath('daily_capacity', 2)
        ->assertJsonPath('booking_mode', 'approval')
        ->assertJsonPath('fee_amount_minor', 150)
        ->assertJsonPath('deposit_amount_minor', 300)
        ->assertJsonCount(9, 'days')
        ->assertJsonMissingPath('slots');

    $days = collect($response->json('days'))->keyBy('date');
    expect($days[$monday])->toBe(['date' => $monday, 'available' => false, 'reason' => 'past', 'approved_count' => 0])
        ->and($days[CarbonImmutable::parse($monday)->addDay()->format('Y-m-d')]['reason'])->toBe('past')
        ->and($days[CarbonImmutable::parse($monday)->addDays(2)->format('Y-m-d')]['reason'])->toBe('closed') // today, but a Wednesday
        ->and($days[CarbonImmutable::parse($monday)->addDays(6)->format('Y-m-d')]['reason'])->toBe('closed')
        ->and($days[$followingMonday])->toBe(['date' => $followingMonday, 'available' => false, 'reason' => 'full', 'approved_count' => 2])
        ->and($days[$followingTuesday])->toBe(['date' => $followingTuesday, 'available' => true, 'reason' => null, 'approved_count' => 0]);

    // Both bounds are required, the range runs forward and covers at most 90 days.
    $this->actingAs($admin)->getJson("/api/amenities/{$amenity->id}/availability?from={$monday}")
        ->assertUnprocessable()->assertJsonValidationErrors('to');
    $this->actingAs($admin)->getJson("/api/amenities/{$amenity->id}/availability?from={$followingMonday}&to={$monday}")
        ->assertUnprocessable()->assertJsonValidationErrors('to');
    $this->actingAs($admin)->getJson("/api/amenities/{$amenity->id}/availability?from={$monday}&to=".CarbonImmutable::parse($monday)->addDays(91)->format('Y-m-d'))
        ->assertUnprocessable()->assertJsonValidationErrors('to');
    $this->actingAs($admin)->getJson("/api/amenities/{$amenity->id}/availability?from={$monday}&to=".CarbonImmutable::parse($monday)->addDays(90)->format('Y-m-d'))
        ->assertOk()->assertJsonCount(91, 'days');

    $outsider = User::factory()->create();
    $this->actingAs($outsider)->getJson("/api/amenities/{$amenity->id}/availability?from={$monday}&to={$monday}")->assertForbidden();
});
