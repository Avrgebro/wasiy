<?php

use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\VisitStatus;
use App\Models\Location;
use App\Models\Package;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Location, Unit, User, User}
 */
function searchWorld(): array
{
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '402', 'building_name' => 'Torre A']);
    $manager = User::factory()->create();
    grantLocationRole($location->account, $location, $manager, LocationRole::LocationManager);
    $desk = User::factory()->create();
    grantLocationRole($location->account, $location, $desk, LocationRole::FrontDesk);

    return [$location, $unit, $manager, $desk];
}

test('search fans one term across units, residents, visits and packages, accent-insensitive', function () {
    [$location, $unit, $manager] = searchWorld();
    $resident = Resident::factory()->for($location->account)->create(['first_name' => 'Patricia', 'last_name' => 'Núñez', 'phone' => '987654321']);
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $resident->id, 'status' => RegistryStatus::Active]);
    Vehicle::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'plate' => 'NUN-402']);
    Visit::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'visitor_name' => 'Jorge Nunez', 'status' => VisitStatus::Inside]);
    Package::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $resident->id, 'notes' => 'Olva']);
    // Another location's resident with the same name never appears.
    Resident::factory()->create(['first_name' => 'Patricia', 'last_name' => 'Núñez']);

    $response = $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/search?q=nuñez")
        ->assertOk();

    $groups = collect($response->json('groups'))->keyBy('key');
    expect($groups->keys()->all())->toBe(['residents', 'visits', 'packages'])
        ->and($groups['residents']['items'])->toHaveCount(1)
        ->and($groups['residents']['items'][0]['label'])->toBe('Patricia Núñez')
        ->and($groups['residents']['items'][0]['description'])->toBe($unit->label())
        ->and($groups['visits']['items'][0]['label'])->toBe('Jorge Nunez')
        ->and($groups['visits']['items'][0]['description'])->toContain('dentro')
        ->and($groups['packages']['items'][0]['label'])->toBe('Patricia Núñez');

    // Phone digits find people; plates find units, with the plate as the hint.
    $this->actingAs($manager)->getJson("/api/locations/{$location->id}/search?q=98765")
        ->assertOk()->assertJsonPath('groups.0.key', 'residents');
    $this->actingAs($manager)->getJson("/api/locations/{$location->id}/search?q=nun-4")
        ->assertOk()
        ->assertJsonPath('groups.0.key', 'units')
        ->assertJsonPath('groups.0.items.0.label', $unit->label())
        ->assertJsonPath('groups.0.items.0.description', 'NUN-402')
        ->assertJsonPath('groups.0.items.0.to.page', 'unit');
});

test('the desk gets people and its logs but never the units group', function () {
    [$location, $unit, , $desk] = searchWorld();
    Visit::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'visitor_name' => 'Elena Vargas']);

    $groups = collect($this->actingAs($desk)->getJson("/api/locations/{$location->id}/search?q=402")->assertOk()->json('groups'))->pluck('key');
    expect($groups->all())->toBe(['visits']);
});

test('search needs two characters and location access', function () {
    [$location, , $manager] = searchWorld();

    $this->actingAs($manager)->getJson("/api/locations/{$location->id}/search?q=a")->assertUnprocessable();
    $this->actingAs(User::factory()->create())->getJson("/api/locations/{$location->id}/search?q=402")->assertForbidden();
});
