<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('manager can create and edit units in an accessible location', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $manager = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    $createResponse = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/units", [
            'unit_number' => '301',
            'building_name' => 'Torre A',
            'floor' => '3',
            'notes' => 'Vista interior',
        ])
        ->assertCreated()
        ->assertJsonPath('data.account_id', $account->id)
        ->assertJsonPath('data.location_id', $location->id)
        ->assertJsonPath('data.unit_number', '301')
        ->assertJsonPath('data.building_name', 'Torre A')
        ->assertJsonPath('data.status', RegistryStatus::Active->value);

    $unitId = $createResponse->json('data.id');

    $this->assertDatabaseHas('units', [
        'id' => $unitId,
        'account_id' => $account->id,
        'location_id' => $location->id,
        'unit_number' => '301',
        'status' => RegistryStatus::Active->value,
    ]);

    $this->actingAs($manager)
        ->patchJson("/api/units/{$unitId}", [
            'unit_number' => '302',
            'building_name' => 'Torre B',
            'floor' => '4',
            'status' => RegistryStatus::Inactive->value,
            'notes' => null,
        ])
        ->assertOk()
        ->assertJsonPath('data.unit_number', '302')
        ->assertJsonPath('data.building_name', 'Torre B')
        ->assertJsonPath('data.status', RegistryStatus::Inactive->value);
});

test('manager cannot create units in an inaccessible location', function () {
    $account = Account::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $manager = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $accessibleLocation->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($manager)
        ->postJson("/api/locations/{$inaccessibleLocation->id}/units", [
            'unit_number' => '401',
        ])
        ->assertForbidden();
});

test('duplicate unit number and building within a location is rejected', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    Unit::factory()->for($account)->for($location)->create([
        'unit_number' => '501',
        'building_name' => null,
    ]);

    $this->actingAs($admin)
        ->postJson("/api/locations/{$location->id}/units", [
            'unit_number' => '501',
            'building_name' => null,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_number');
});

test('same unit number can exist in different locations', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $admin = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    Unit::factory()->for($account)->for($firstLocation)->create([
        'unit_number' => '601',
        'building_name' => 'Torre A',
    ]);

    $this->actingAs($admin)
        ->postJson("/api/locations/{$secondLocation->id}/units", [
            'unit_number' => '601',
            'building_name' => 'Torre A',
        ])
        ->assertCreated();
});

test('unit list defaults to active units and supports search filters sort and summary fields', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    $activeUnit = Unit::factory()->for($account)->for($location)->create([
        'unit_number' => '701',
        'building_name' => 'Torre A',
        'floor' => '7',
        'status' => RegistryStatus::Active,
    ]);
    Unit::factory()->for($account)->for($location)->create([
        'unit_number' => '702',
        'building_name' => 'Torre B',
        'status' => RegistryStatus::Inactive,
    ]);
    Unit::factory()->for($account)->for($location)->create([
        'unit_number' => '801',
        'building_name' => 'Otra Torre',
        'status' => RegistryStatus::Active,
    ]);
    $resident = Resident::factory()->for($account)->create([
        'first_name' => 'Ana',
        'last_name' => 'Salas',
        'phone' => '999',
    ]);
    UnitMembership::factory()
        ->for($resident)
        ->for($activeUnit)
        ->for($account)
        ->for($location)
        ->primaryContact()
        ->create([
            'resident_type' => ResidentType::Owner,
        ]);
    Vehicle::factory()->for($activeUnit)->for($account)->for($location)->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $this->actingAs($admin)
        ->getJson("/api/locations/{$location->id}/units?search=torre%20a&sort=-resident_count&per_page=5")
        ->assertOk()
        ->assertJsonPath('data.0.id', $activeUnit->id)
        ->assertJsonPath('data.0.resident_count', 1)
        ->assertJsonPath('data.0.vehicle_count', 1)
        ->assertJsonPath('data.0.primary_contact.name', 'Ana Salas')
        ->assertJsonMissing(['702'])
        ->assertJsonPath('meta.per_page', 5);
});

test('delete hard deletes empty units and inactivates units with dependent records', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    $emptyUnit = Unit::factory()->for($account)->for($location)->create();
    $dependentUnit = Unit::factory()->for($account)->for($location)->create();
    $resident = Resident::factory()->for($account)->create();

    UnitMembership::factory()
        ->for($resident)
        ->for($dependentUnit)
        ->for($account)
        ->for($location)
        ->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $this->actingAs($admin)
        ->deleteJson("/api/units/{$emptyUnit->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('units', [
        'id' => $emptyUnit->id,
    ]);

    $this->actingAs($admin)
        ->deleteJson("/api/units/{$dependentUnit->id}")
        ->assertOk()
        ->assertJsonPath('data.status', RegistryStatus::Inactive->value);

    $this->assertDatabaseHas('units', [
        'id' => $dependentUnit->id,
        'status' => RegistryStatus::Inactive->value,
    ]);
});
