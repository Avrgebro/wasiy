<?php

use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\Package;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Location, Unit, Resident, User, User}
 */
function portalVisitWorld(): array
{
    $location = Location::factory()->create(['timezone' => 'America/Lima']);
    $unit = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '402']);
    $user = User::factory()->create();
    $resident = Resident::factory()->for($location->account)->create(['user_id' => $user->id, 'first_name' => 'Carlos', 'last_name' => 'Mendoza']);
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $resident->id, 'status' => RegistryStatus::Active]);
    $desk = User::factory()->create();
    grantLocationRole($location->account, $location, $desk, LocationRole::FrontDesk);

    return [$location, $unit, $resident, $user, $desk];
}

test('a resident pre-registers a visitor for their unit, sees it as expected, and can cancel it', function () {
    [$location, $unit, , $user] = portalVisitWorld();
    $today = now($location->timezone)->toDateString();

    $visit = $this->actingAs($user)
        ->postJson('/api/portal/visits', ['unit_id' => $unit->id, 'visitor_name' => 'Jorge Peña', 'document' => '41290877', 'expected_on' => $today, 'expected_time' => '19:00', 'notes' => 'Viene a recoger unas llaves.'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'expected')
        ->assertJsonPath('data.confirmation', 'pre_registered')
        ->assertJsonPath('data.expected_on', $today)
        ->assertJsonPath('data.expected_time', '19:00')
        ->assertJsonPath('data.pre_registered_by_name', 'Carlos Mendoza')
        ->assertJsonPath('data.checked_in_at', null)
        ->json('data');

    // Yesterday is refused; a future day without a time is fine.
    $this->actingAs($user)->postJson('/api/portal/visits', ['unit_id' => $unit->id, 'visitor_name' => 'X', 'expected_on' => now($location->timezone)->subDay()->toDateString()])
        ->assertUnprocessable()->assertJsonValidationErrors('expected_on');
    $this->actingAs($user)->postJson('/api/portal/visits', ['unit_id' => $unit->id, 'visitor_name' => 'Ana Loayza', 'expected_on' => now($location->timezone)->addDays(2)->toDateString()])
        ->assertCreated()->assertJsonPath('data.expected_time', null);

    $this->actingAs($user)->getJson("/api/portal/visits?unit_id={$unit->id}&scope=expected")
        ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.visitor_name', 'Jorge Peña');

    $this->actingAs($user)->postJson("/api/portal/visits/{$visit['id']}/cancel")
        ->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->actingAs($user)->postJson("/api/portal/visits/{$visit['id']}/cancel")->assertUnprocessable();
    $this->actingAs($user)->getJson("/api/portal/visits?unit_id={$unit->id}&scope=history")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'cancelled');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::VisitPreRegistered->value)->count())->toBe(2)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::VisitCancelled->value)->count())->toBe(1);
});

test('a resident cannot announce or read visits for a unit they do not live in', function () {
    [$location, , , $user] = portalVisitWorld();
    $other = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '118']);

    $this->actingAs($user)->postJson('/api/portal/visits', ['unit_id' => $other->id, 'visitor_name' => 'X', 'expected_on' => now()->toDateString()])->assertForbidden();
    $this->actingAs($user)->getJson("/api/portal/visits?unit_id={$other->id}")->assertForbidden();
});

test('the desk lists today\'s expected visitors per unit and confirms an arrival into a normal visit', function () {
    [$location, $unit, $resident, , $desk] = portalVisitWorld();
    $expected = Visit::factory()->expected()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $resident->id, 'pre_registered_by' => $resident->id, 'visitor_name' => 'Jorge Peña', 'document' => '41290877']);
    Visit::factory()->expected(now()->addDay()->toDateString())->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'visitor_name' => 'Mañana']);
    Visit::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'visitor_name' => 'Walk-in']);

    // The default log shows the door, not the announcements.
    $this->actingAs($desk)->getJson("/api/locations/{$location->id}/visits")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.visitor_name', 'Walk-in');
    $this->actingAs($desk)->getJson("/api/locations/{$location->id}/visits?expected=1&unit_id={$unit->id}")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.visitor_name', 'Jorge Peña')->assertJsonPath('data.0.pre_registered_by_name', 'Carlos Mendoza');

    $this->actingAs($desk)->postJson("/api/visits/{$expected->id}/confirm-arrival", ['document' => '41290878', 'notes' => 'Subió directo.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'inside')
        ->assertJsonPath('data.confirmation', 'pre_registered')
        ->assertJsonPath('data.document', '41290878')
        ->assertJsonPath('data.checked_in_by_name', $desk->name);
    expect($expected->fresh()->checked_in_at)->not->toBeNull();

    // Twice is refused; the visit now checks out like any other.
    $this->actingAs($desk)->postJson("/api/visits/{$expected->id}/confirm-arrival")->assertUnprocessable();
    $this->actingAs($desk)->postJson("/api/visits/{$expected->id}/check-out")->assertOk()->assertJsonPath('data.status', 'left');
});

test('the home board scope shows today\'s expected visitors and today\'s arrivals, and packages are read per unit', function () {
    [$location, $unit, $resident, $user] = portalVisitWorld();
    Visit::factory()->expected()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $resident->id, 'visitor_name' => 'Jorge Peña', 'expected_time' => '19:00']);
    Visit::factory()->expected(now()->addDay()->toDateString())->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'visitor_name' => 'Mañana']);
    Visit::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'visitor_name' => 'Delivery Rappi', 'checked_in_at' => now()->subHour()]);
    Package::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'notes' => 'Olva Courier']);
    $other = Unit::factory()->for($location->account)->for($location)->create();
    Package::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $other->id]);

    $this->actingAs($user)->getJson("/api/portal/visits?unit_id={$unit->id}&scope=today")
        ->assertOk()->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.visitor_name', 'Jorge Peña')
        ->assertJsonPath('data.1.visitor_name', 'Delivery Rappi');

    $this->actingAs($user)->getJson("/api/portal/packages?unit_id={$unit->id}&status=pending")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.notes', 'Olva Courier');
    $this->actingAs($user)->getJson("/api/portal/packages?unit_id={$other->id}")->assertForbidden();
});
