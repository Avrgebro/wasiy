<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Location, Unit, User}
 */
function phoneWorld(string $country = 'PE'): array
{
    $location = Location::factory()->create(['country' => $country]);
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $manager = User::factory()->create();
    grantLocationRole($location->account, $location, $manager, LocationRole::LocationManager);

    return [$location, $unit, $manager];
}

test('a resident phone typed nationally is stored in E.164 for the unit location country', function () {
    [$location, $unit, $manager] = phoneWorld();

    $id = $this->actingAs($manager)
        ->postJson("/api/accounts/{$location->account_id}/residents", [
            'first_name' => 'Patricia', 'last_name' => 'Núñez', 'phone' => '987 654 321',
            'memberships' => [['unit_id' => $unit->id]],
        ])
        ->assertCreated()
        ->assertJsonPath('data.phone', '+51987654321')
        ->json('data.id');

    // An international number keeps its own country; a bad one is refused.
    $this->actingAs($manager)->patchJson("/api/residents/{$id}", ['phone' => '+56 9 8765 4321'])
        ->assertOk()->assertJsonPath('data.phone', '+56987654321');
    $this->actingAs($manager)->patchJson("/api/residents/{$id}", ['phone' => '12'])
        ->assertUnprocessable()->assertJsonValidationErrors('phone');
    $this->actingAs($manager)->patchJson("/api/residents/{$id}", ['phone' => ''])
        ->assertOk()->assertJsonPath('data.phone', null);

    // Digits find people however they were typed.
    $this->actingAs($manager)->patchJson("/api/residents/{$id}", ['phone' => '987-654-321'])->assertOk();
    $this->actingAs($manager)->getJson("/api/accounts/{$location->account_id}/residents?location_id={$location->id}&search=654%20321")
        ->assertOk()->assertJsonCount(1, 'data');
});

test('a location in another country dials its own prefix', function () {
    [$location, $unit, $manager] = phoneWorld('CL');

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$location->account_id}/residents", [
            'first_name' => 'Camila', 'last_name' => 'Rojas', 'phone' => '9 8765 4321',
            'memberships' => [['unit_id' => $unit->id]],
        ])
        ->assertCreated()
        ->assertJsonPath('data.phone', '+56987654321');
});

test('visit and location phones follow the same rule', function () {
    [$location, $unit, $manager] = phoneWorld();

    $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/visits", ['visitor_name' => 'Jorge Peña', 'unit_id' => $unit->id, 'phone' => '(01) 302-4410'])
        ->assertCreated()
        ->assertJsonPath('data.phone', '+5113024410');

    $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/visits", ['visitor_name' => 'Jorge Peña', 'unit_id' => $unit->id, 'phone' => 'abc'])
        ->assertUnprocessable()->assertJsonValidationErrors('phone');

    $admin = User::factory()->create();
    createStaffMembership($location->account, $admin, AccountRole::AccountAdmin);
    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$location->account_id}/locations/{$location->id}", ['phone' => '01 302 4410'])
        ->assertOk()
        ->assertJsonPath('data.phone', '+5113024410');
});
