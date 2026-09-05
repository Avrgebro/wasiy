<?php

use App\Enums\BookingMode;
use App\Enums\RegistryStatus;
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
        'availability' => ['monday' => [['start' => '09:00', 'end' => '21:00']]],
        'min_duration_minutes' => 120,
        'max_duration_minutes' => 240,
        'fee_amount' => 150,
        'deposit_amount' => 300,
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

test('a resident browses reservable amenities of their location and reads their photos', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld();
    Amenity::factory()->for($location)->create(['account_id' => $location->account_id, 'name' => 'Lobby', 'is_reservable' => false]);
    Amenity::factory()->create(['name' => 'Elsewhere']);

    $this->actingAs($user)->getJson("/api/portal/amenities?unit_id={$unit->id}")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Salón de eventos')
        ->assertJsonPath('data.0.effective_booking_policy.cancellation_window_hours.value', fn ($value) => is_int($value));

    expect(Gate::forUser($user)->allows('view', $amenity))->toBeTrue();
    $stranger = User::factory()->create();
    $this->actingAs($stranger)->getJson("/api/portal/amenities?unit_id={$unit->id}")->assertForbidden();
});

test('availability lays slots on the windows and marks taken and past ones', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld();
    $monday = nextMondayLima();
    // Someone already holds 12:00–14:00 that day.
    Reservation::factory()->create([
        'account_id' => $location->account_id, 'location_id' => $location->id, 'amenity_id' => $amenity->id,
        'unit_id' => Unit::factory()->for($location->account)->for($location)->create()->id,
        'starts_at' => CarbonImmutable::parse("{$monday} 12:00", 'America/Lima')->utc(),
        'ends_at' => CarbonImmutable::parse("{$monday} 14:00", 'America/Lima')->utc(),
    ]);

    $response = $this->actingAs($user)->getJson("/api/portal/amenities/{$amenity->id}/availability?unit_id={$unit->id}&date={$monday}")
        ->assertOk()
        ->assertJsonPath('slot_minutes', 120)
        ->assertJsonPath('booking_mode', 'approval')
        ->assertJsonCount(6, 'slots');

    $slots = collect($response->json('slots'))->keyBy('start');
    expect($slots['09:00']['available'])->toBeTrue()
        ->and($slots['11:00']['available'])->toBeFalse() // 11–13 overlaps the 12–14 booking
        ->and($slots['13:00']['available'])->toBeFalse()
        ->and($slots['15:00']['available'])->toBeTrue()
        ->and($slots['19:00']['end'])->toBe('21:00');

    // Yesterday and beyond the advance window are refused outright.
    $this->actingAs($user)->getJson("/api/portal/amenities/{$amenity->id}/availability?unit_id={$unit->id}&date=".now('America/Lima')->subDay()->toDateString())
        ->assertUnprocessable()->assertJsonValidationErrors('date');
    $this->actingAs($user)->getJson("/api/portal/amenities/{$amenity->id}/availability?unit_id={$unit->id}&date=".now('America/Lima')->addDays(400)->toDateString())
        ->assertUnprocessable()->assertJsonValidationErrors('date');
});

test('a resident requests a booking that enters the queue, sees it upcoming, and cancels it', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld();
    $monday = nextMondayLima();

    $reservation = $this->actingAs($user)
        ->postJson('/api/portal/reservations', ['unit_id' => $unit->id, 'amenity_id' => $amenity->id, 'date' => $monday, 'start' => '19:00', 'end' => '21:00'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.fee_snapshot', 150)
        ->assertJsonPath('data.resident_name', 'Carlos Mendoza')
        ->json('data');

    $this->actingAs($user)->getJson("/api/portal/reservations?unit_id={$unit->id}&scope=upcoming")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.amenity_name', 'Salón de eventos');
    $this->actingAs($user)->getJson("/api/portal/reservations/{$reservation['id']}")
        ->assertOk()
        ->assertJsonPath('can_cancel', true)
        ->assertJsonPath('history.0.event_type', 'reservation.created');

    // Someone who does not live in the unit can neither read it nor book for it.
    $other = User::factory()->create();
    $this->actingAs($other)->getJson("/api/portal/reservations/{$reservation['id']}")->assertForbidden();
    $this->actingAs($other)
        ->postJson('/api/portal/reservations', ['unit_id' => $unit->id, 'amenity_id' => $amenity->id, 'date' => $monday, 'start' => '09:00', 'end' => '11:00'])
        ->assertForbidden();

    $this->actingAs($user)->postJson("/api/portal/reservations/{$reservation['id']}/cancel")
        ->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->actingAs($user)->getJson("/api/portal/reservations?unit_id={$unit->id}&scope=past")
        ->assertOk()->assertJsonCount(1, 'data');
});

test('an instant amenity confirms on the spot and the cancellation window is enforced for residents', function () {
    [$location, $amenity, $unit, $user] = portalReservationWorld(['booking_mode' => BookingMode::Instant, 'cancellation_window_hours' => 24]);
    $monday = nextMondayLima();

    $id = $this->actingAs($user)
        ->postJson('/api/portal/reservations', ['unit_id' => $unit->id, 'amenity_id' => $amenity->id, 'date' => $monday, 'start' => '09:00', 'end' => '11:00'])
        ->assertCreated()->assertJsonPath('data.status', 'approved')->json('data.id');

    // Jump to inside the window: cancelling is refused and the detail says so.
    $this->travelTo(CarbonImmutable::parse("{$monday} 08:00", 'America/Lima'));
    $this->actingAs($user)->getJson("/api/portal/reservations/{$id}")->assertOk()->assertJsonPath('can_cancel', false);
    $this->actingAs($user)->postJson("/api/portal/reservations/{$id}/cancel")->assertUnprocessable();
});
