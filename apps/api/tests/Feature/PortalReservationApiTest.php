<?php

use App\Enums\AccountRole;
use App\Enums\BookingMode;
use App\Enums\RegistryStatus;
use App\Enums\ReservationStatus;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Location, Amenity, Unit, User}
 */
function portalReservationWorld(array $amenity = []): array
{
    $location = Location::factory()->create(['timezone' => 'America/Lima']);
    $amenity = Amenity::factory()->for($location)->create([
        'account_id' => $location->account_id,
        'name' => 'Salón de eventos',
        'booking_mode' => BookingMode::Approval,
        'open_days' => ['monday'],
        'daily_capacity' => null,
        'fee_amount_minor' => 150,
        'deposit_amount_minor' => 300,
        ...$amenity,
    ]);
    $unit = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '402']);
    $user = User::factory()->create();
    $resident = Resident::factory()->for($location->account)->create(['user_id' => $user->id, 'first_name' => 'Carlos', 'last_name' => 'Mendoza']);
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $resident->id, 'status' => RegistryStatus::Active]);

    return [$location, $amenity, $unit, $user];
}

function nextMondayLima(): string
{
    return CarbonImmutable::now('America/Lima')->addWeek()->next('Monday')->format('Y-m-d');
}

function portalBooking(Unit $unit, Amenity $amenity, string $date): array
{
    return ['unit_id' => $unit->id, 'amenity_id' => $amenity->id, 'date' => $date];
}

test('a resident browses reservable amenities of their location with their open days and capacity', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld(['daily_capacity' => 1]);
    Amenity::factory()->for($location)->create(['account_id' => $location->account_id, 'name' => 'Lobby', 'is_reservable' => false]);
    Amenity::factory()->create(['name' => 'Elsewhere']);

    $this->actingAs($user)->getJson("/api/portal/amenities?unit_id={$unit->id}")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Salón de eventos')
        ->assertJsonPath('data.0.open_days', ['monday'])
        ->assertJsonPath('data.0.daily_capacity', 1)
        ->assertJsonMissingPath('data.0.slot_minutes')
        ->assertJsonMissingPath('data.0.availability');

    expect(Gate::forUser($user)->allows('view', $amenity))->toBeTrue();
    $stranger = User::factory()->create();
    $this->actingAs($stranger)->getJson("/api/portal/amenities?unit_id={$unit->id}")->assertForbidden();
});

test('availability lists the days of a range and marks past, closed and full ones', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld(['daily_capacity' => 1]);
    $monday = nextMondayLima();
    $this->travelTo(CarbonImmutable::parse("{$monday} 12:30", 'America/Lima')->utc());

    $sunday = CarbonImmutable::parse($monday)->subDay()->format('Y-m-d');
    $tuesday = CarbonImmutable::parse($monday)->addDay()->format('Y-m-d');
    $followingMonday = CarbonImmutable::parse($monday)->addWeek()->format('Y-m-d');
    // Another unit holds the following Monday, approved: with capacity 1 the day is full.
    Reservation::factory()->create([
        'account_id' => $location->account_id, 'location_id' => $location->id, 'amenity_id' => $amenity->id,
        'unit_id' => Unit::factory()->for($location->account)->for($location)->create()->id,
        'reserved_on' => $followingMonday,
        'status' => ReservationStatus::Approved,
    ]);

    $response = $this->actingAs($user)->getJson("/api/portal/amenities/{$amenity->id}/availability?unit_id={$unit->id}&from={$sunday}&to={$followingMonday}")
        ->assertOk()
        ->assertJsonPath('daily_capacity', 1)
        ->assertJsonPath('booking_mode', 'approval')
        ->assertJsonPath('fee_amount_minor', 150)
        ->assertJsonPath('deposit_amount_minor', 300)
        ->assertJsonCount(9, 'days');

    $days = collect($response->json('days'))->keyBy('date');
    expect($days[$sunday])->toBe(['date' => $sunday, 'available' => false, 'reason' => 'past', 'approved_count' => 0])
        ->and($days[$monday])->toBe(['date' => $monday, 'available' => true, 'reason' => null, 'approved_count' => 0]) // today, whatever the hour
        ->and($days[$tuesday])->toBe(['date' => $tuesday, 'available' => false, 'reason' => 'closed', 'approved_count' => 0])
        ->and($days[$followingMonday])->toBe(['date' => $followingMonday, 'available' => false, 'reason' => 'full', 'approved_count' => 1]);

    // Both bounds are required; the range runs forward and covers at most 90 days.
    $this->actingAs($user)->getJson("/api/portal/amenities/{$amenity->id}/availability?unit_id={$unit->id}&from={$monday}")
        ->assertUnprocessable()->assertJsonValidationErrors('to');
    $this->actingAs($user)->getJson("/api/portal/amenities/{$amenity->id}/availability?unit_id={$unit->id}&from={$monday}&to={$sunday}")
        ->assertUnprocessable()->assertJsonValidationErrors('to');
    $this->actingAs($user)->getJson("/api/portal/amenities/{$amenity->id}/availability?unit_id={$unit->id}&from={$monday}&to=".CarbonImmutable::parse($monday)->addDays(91)->format('Y-m-d'))
        ->assertUnprocessable()->assertJsonValidationErrors('to');
});

test('the portal refuses a full day while staff still book it', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld(['daily_capacity' => 1]);
    $monday = nextMondayLima();
    $otherUnit = Unit::factory()->for($location->account)->for($location)->create();
    Reservation::factory()->create([
        'account_id' => $location->account_id, 'location_id' => $location->id, 'amenity_id' => $amenity->id,
        'unit_id' => $otherUnit->id, 'reserved_on' => $monday, 'status' => ReservationStatus::Approved,
    ]);

    $this->actingAs($user)
        ->postJson('/api/portal/reservations', portalBooking($unit, $amenity, $monday))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['date' => 'full']);

    // Staff are never blocked by capacity.
    $admin = User::factory()->create();
    createStaffMembership($location->account, $admin, AccountRole::AccountAdmin);
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$location->account_id}/locations/{$location->id}/reservations", portalBooking($unit, $amenity, $monday))
        ->assertCreated()
        ->assertJsonPath('data.reserved_on', $monday);

    // Only approved bookings count: a day held by pending requests alone is open.
    $tuesdayAmenity = Amenity::factory()->for($location)->create(['account_id' => $location->account_id, 'open_days' => ['monday'], 'daily_capacity' => 1, 'booking_mode' => BookingMode::Approval]);
    Reservation::factory()->pending()->create([
        'account_id' => $location->account_id, 'location_id' => $location->id, 'amenity_id' => $tuesdayAmenity->id,
        'unit_id' => $otherUnit->id, 'reserved_on' => $monday,
    ]);
    $this->actingAs($user)
        ->postJson('/api/portal/reservations', portalBooking($unit, $tuesdayAmenity, $monday))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');
});

test('a resident requests a booking that enters the queue, sees it upcoming, and cancels it', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld();
    $monday = nextMondayLima();

    $reservation = $this->actingAs($user)
        ->postJson('/api/portal/reservations', portalBooking($unit, $amenity, $monday))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.reserved_on', $monday)
        ->assertJsonPath('data.fee_snapshot_minor', 150)
        ->assertJsonPath('data.resident_name', 'Carlos Mendoza')
        ->json('data');

    $this->actingAs($user)->getJson("/api/portal/reservations?unit_id={$unit->id}&scope=upcoming")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.amenity_name', 'Salón de eventos');
    $this->actingAs($user)->getJson("/api/portal/reservations/{$reservation['id']}")
        ->assertOk()
        ->assertJsonPath('can_cancel', true)
        ->assertJsonPath('history.0.event_type', 'reservation.created');

    // A closed weekday and a day past the horizon are refused.
    $this->actingAs($user)
        ->postJson('/api/portal/reservations', portalBooking($unit, $amenity, CarbonImmutable::parse($monday)->addDay()->format('Y-m-d')))
        ->assertUnprocessable()->assertJsonValidationErrors('reserved_on');
    $farMonday = CarbonImmutable::parse($monday)->addWeeks(14)->format('Y-m-d');
    $this->actingAs($user)
        ->postJson('/api/portal/reservations', portalBooking($unit, $amenity, $farMonday))
        ->assertUnprocessable()->assertJsonValidationErrors('reserved_on');

    // Someone who does not live in the unit can neither read it nor book for it.
    $other = User::factory()->create();
    $this->actingAs($other)->getJson("/api/portal/reservations/{$reservation['id']}")->assertForbidden();
    $this->actingAs($other)
        ->postJson('/api/portal/reservations', portalBooking($unit, $amenity, $monday))
        ->assertForbidden();

    $this->actingAs($user)->postJson("/api/portal/reservations/{$reservation['id']}/cancel")
        ->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->actingAs($user)->getJson("/api/portal/reservations?unit_id={$unit->id}&scope=past")
        ->assertOk()->assertJsonCount(1, 'data');
});

test('an instant amenity confirms on the spot and a resident may cancel until the booked day arrives', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld(['booking_mode' => BookingMode::Instant]);
    $monday = nextMondayLima();

    $id = $this->actingAs($user)
        ->postJson('/api/portal/reservations', portalBooking($unit, $amenity, $monday))
        ->assertCreated()->assertJsonPath('data.status', 'approved')->json('data.id');

    // Late the day before, in Lima, it can still be cancelled (UTC is already Monday).
    $this->travelTo(CarbonImmutable::parse("{$monday} 23:30", 'America/Lima')->subDay()->utc());
    expect(now()->toDateString())->toBe($monday);
    $this->actingAs($user)->getJson("/api/portal/reservations/{$id}")->assertOk()
        ->assertJsonPath('can_cancel', true)->assertJsonPath('data.is_completed', false);

    // On the day itself the booking is still open: it lists as upcoming and may still be cancelled.
    $this->travelTo(CarbonImmutable::parse("{$monday} 00:30", 'America/Lima')->utc());
    $this->actingAs($user)->getJson("/api/portal/reservations/{$id}")->assertOk()
        ->assertJsonPath('can_cancel', true)->assertJsonPath('data.is_completed', false);
    $this->actingAs($user)->getJson("/api/portal/reservations?unit_id={$unit->id}&scope=upcoming")->assertOk()->assertJsonCount(1, 'data');

    // The day after, it is completed, belongs to the past, and the cancel is refused.
    $this->travelTo(CarbonImmutable::parse("{$monday} 09:00", 'America/Lima')->addDay()->utc());
    $this->actingAs($user)->getJson("/api/portal/reservations/{$id}")->assertOk()
        ->assertJsonPath('can_cancel', false)->assertJsonPath('data.is_completed', true);
    $this->actingAs($user)->postJson("/api/portal/reservations/{$id}/cancel")->assertUnprocessable()->assertJsonValidationErrors('status');
    $this->actingAs($user)->getJson("/api/portal/reservations?unit_id={$unit->id}&scope=past")->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs($user)->getJson("/api/portal/reservations?unit_id={$unit->id}&scope=upcoming")->assertOk()->assertJsonCount(0, 'data');
});
