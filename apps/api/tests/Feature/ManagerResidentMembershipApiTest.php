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
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createRegistryManager(Location $location): User
{
    $manager = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    return $manager;
}

function createRegistryAdmin(Account $account): User
{
    $admin = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    return $admin;
}

test('manager can create a resident and assign them to a unit', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $manager = createRegistryManager($location);

    $response = $this->actingAs($manager)
        ->postJson("/api/accounts/{$location->account_id}/residents", [
            'first_name' => 'Ana',
            'last_name' => 'Salas',
            'phone' => '999111222',
            'email' => 'ana@example.test',
            'memberships' => [
                [
                    'unit_id' => $unit->id,
                    'resident_type' => ResidentType::Tenant->value,
                    'is_primary_contact' => true,
                    'started_at' => '2026-06-01',
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Ana Salas')
        ->assertJsonPath('data.memberships.0.unit_id', $unit->id)
        ->assertJsonPath('data.memberships.0.resident_type', ResidentType::Tenant->value)
        ->assertJsonPath('data.memberships.0.is_primary_contact', true);

    $this->assertDatabaseHas('residents', [
        'id' => $response->json('data.id'),
        'account_id' => $location->account_id,
        'email' => 'ana@example.test',
    ]);
});

test('resident can belong to multiple units', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $firstUnit = Unit::factory()->for($account)->for($firstLocation)->create();
    $secondUnit = Unit::factory()->for($account)->for($secondLocation)->create();
    $admin = createRegistryAdmin($account);

    $residentId = $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/residents", [
            'first_name' => 'Luis',
            'last_name' => 'Ramos',
            'memberships' => [
                ['unit_id' => $firstUnit->id, 'resident_type' => ResidentType::Owner->value],
                ['unit_id' => $secondUnit->id, 'resident_type' => ResidentType::Occupant->value],
            ],
        ])
        ->assertCreated()
        ->assertJsonCount(2, 'data.memberships')
        ->json('data.id');

    expect(Resident::find($residentId)->unitMemberships()->count())->toBe(2);
});

test('location manager resident list is constrained to accessible memberships', function () {
    $account = Account::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $accessibleUnit = Unit::factory()->for($account)->for($accessibleLocation)->create();
    $inaccessibleUnit = Unit::factory()->for($account)->for($inaccessibleLocation)->create();
    $visibleResident = Resident::factory()->for($account)->create(['first_name' => 'Visible']);
    $hiddenResident = Resident::factory()->for($account)->create(['first_name' => 'Hidden']);
    Resident::factory()->for($account)->create(['first_name' => 'Incomplete']);
    UnitMembership::factory()
        ->for($visibleResident)
        ->for($accessibleUnit)
        ->for($account)
        ->for($accessibleLocation)
        ->create();
    UnitMembership::factory()
        ->for($hiddenResident)
        ->for($inaccessibleUnit)
        ->for($account)
        ->for($inaccessibleLocation)
        ->create();
    $manager = createRegistryManager($accessibleLocation);

    $this->actingAs($manager)
        ->getJson("/api/accounts/{$account->id}/residents")
        ->assertOk()
        ->assertJsonPath('data.0.id', $visibleResident->id)
        ->assertJsonCount(1, 'data');
});

test('location manager cannot assign resident to a unit outside accessible locations', function () {
    $account = Account::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $unit = Unit::factory()->for($account)->for($inaccessibleLocation)->create();
    $manager = createRegistryManager($accessibleLocation);

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/residents", [
            'first_name' => 'Marta',
            'last_name' => 'Vega',
            'memberships' => [
                ['unit_id' => $unit->id, 'resident_type' => ResidentType::Tenant->value],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('memberships.0.unit_id');
});

test('account admin can manage cross location memberships in the account', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $resident = Resident::factory()->for($account)->create();
    $unit = Unit::factory()->for($account)->for($secondLocation)->create();
    $admin = createRegistryAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/residents/{$resident->id}/memberships", [
            'unit_id' => $unit->id,
            'resident_type' => ResidentType::GuestResident->value,
            'status' => RegistryStatus::Active->value,
        ])
        ->assertCreated()
        ->assertJsonPath('data.location_id', $secondLocation->id);

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/residents?location_id={$firstLocation->id}")
        ->assertOk();
});

test('primary contact replacement is atomic', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $firstResident = Resident::factory()->for($location->account)->create();
    $secondResident = Resident::factory()->for($location->account)->create();
    $firstMembership = UnitMembership::factory()
        ->for($firstResident)
        ->for($unit)
        ->for($location->account)
        ->for($location)
        ->primaryContact()
        ->create();
    $secondMembership = UnitMembership::factory()
        ->for($secondResident)
        ->for($unit)
        ->for($location->account)
        ->for($location)
        ->create();
    $manager = createRegistryManager($location);

    $this->actingAs($manager)
        ->patchJson("/api/unit-memberships/{$secondMembership->id}", [
            'is_primary_contact' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.is_primary_contact', true);

    expect($firstMembership->fresh()->is_primary_contact)->toBeFalse()
        ->and($secondMembership->fresh()->is_primary_contact)->toBeTrue();
});

test('resident delete becomes inactive when memberships exist', function () {
    $location = Location::factory()->create();
    $resident = Resident::factory()->for($location->account)->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    UnitMembership::factory()
        ->for($resident)
        ->for($unit)
        ->for($location->account)
        ->for($location)
        ->create();
    $manager = createRegistryManager($location);

    $this->actingAs($manager)
        ->deleteJson("/api/residents/{$resident->id}")
        ->assertOk()
        ->assertJsonPath('data.status', RegistryStatus::Inactive->value);

    $this->assertDatabaseHas('residents', [
        'id' => $resident->id,
        'status' => RegistryStatus::Inactive->value,
    ]);
});
