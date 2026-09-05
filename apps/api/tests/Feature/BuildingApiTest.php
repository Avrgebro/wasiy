<?php

use App\Enums\LocationRole;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Location, User, User}
 */
function buildingWorld(): array
{
    $location = Location::factory()->create();
    $manager = User::factory()->create();
    grantLocationRole($location->account, $location, $manager, LocationRole::LocationManager);
    $desk = User::factory()->create();
    grantLocationRole($location->account, $location, $desk, LocationRole::FrontDesk);

    return [$location, $manager, $desk];
}

test('a location starts with one unnamed building and its units show no tower', function () {
    [$location, $manager] = buildingWorld();

    $this->actingAs($manager)->getJson("/api/locations/{$location->id}/buildings")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', null);

    $unit = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/units", ['unit_number' => '402'])
        ->assertCreated()
        ->assertJsonPath('data.building_name', null)
        ->json('data');

    expect(Unit::query()->findOrFail($unit['id'])->label())->toBe('402');
});

test('towers are added, renamed in one place, and protected from deletion while in use', function () {
    [$location, $manager, $desk] = buildingWorld();
    $default = $location->buildings()->sole();

    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/buildings", ['name' => 'Torre B'])->assertForbidden();
    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/buildings", ['name' => ''])->assertUnprocessable();

    $torreB = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/buildings", ['name' => 'Torre B', 'code' => 'T2'])
        ->assertCreated()
        ->assertJsonPath('data.code', 'T2')
        ->json('data');

    // With two buildings the first one needs a name too; a blank is refused.
    $this->actingAs($manager)->patchJson("/api/buildings/{$default->id}", ['name' => null])->assertUnprocessable();
    $this->actingAs($manager)->patchJson("/api/buildings/{$default->id}", ['name' => 'Torre A', 'code' => 'T1'])->assertOk();
    // Names are unique per location, accents and case aside.
    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/buildings", ['name' => 'torre b'])->assertUnprocessable();

    $unit = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '402', 'building_id' => $torreB['id']]);
    expect($unit->label())->toBe('Torre B / 402');

    // Renaming cascades by construction.
    $this->actingAs($manager)->patchJson("/api/buildings/{$torreB['id']}", ['name' => 'Torre Norte'])->assertOk();
    expect($unit->fresh()->label())->toBe('Torre Norte / 402')
        ->and($unit->fresh()->building_name)->toBe('Torre Norte');

    $this->actingAs($manager)->getJson("/api/locations/{$location->id}/buildings")
        ->assertOk()
        ->assertJsonPath('data.1.units_count', 1);

    // In use: blocked. Empty and not the last one: gone. Last one: kept.
    $this->actingAs($manager)->deleteJson("/api/buildings/{$torreB['id']}")->assertUnprocessable();
    $this->actingAs($manager)->deleteJson("/api/buildings/{$default->id}")->assertOk();
    $this->actingAs($manager)->deleteJson("/api/buildings/{$torreB['id']}")->assertUnprocessable();
    $this->assertDatabaseCount('buildings', Location::query()->count());
});

test('a unit posted without a building lands in the default one and duplicates are per building', function () {
    [$location, $manager] = buildingWorld();
    $torreB = $location->buildings()->create(['account_id' => $location->account_id, 'name' => 'Torre B', 'sort_order' => 1]);

    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/units", ['unit_number' => '101'])->assertCreated();
    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/units", ['unit_number' => '101'])->assertUnprocessable();
    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/units", ['unit_number' => '101', 'building_id' => $torreB->id])
        ->assertCreated()
        ->assertJsonPath('data.building_name', 'Torre B');
});
