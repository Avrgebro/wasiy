<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\LocationType;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function locationAdmin(Account $account): User
{
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return $admin;
}

function validLocationPayload(array $overrides = []): array
{
    return [
        'name' => 'Torre Mirador',
        'type' => LocationType::MultifamilyBuilding->value,
        'address_line1' => 'Malecón de la Reserva 610',
        'district' => 'Miraflores',
        'city' => 'Lima',
        ...$overrides,
    ];
}

test('an account admin can create a location, active and immediately accessible', function () {
    $account = Account::factory()->create();
    Location::factory()->for($account)->create();
    $admin = locationAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations", validLocationPayload())
        ->assertCreated()
        ->assertJsonPath('data.name', 'Torre Mirador')
        ->assertJsonPath('data.slug', 'torre-mirador')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.country', 'PE')
        ->assertJsonPath('data.units_count', 0);

    $this->actingAs($admin)->postJson('/api/context/account', ['account_id' => $account->id]);

    $accessible = $this->actingAs($admin)->getJson('/api/me')->json('accessible_locations');
    expect(collect($accessible)->pluck('name'))->toContain('Torre Mirador');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::LocationCreated->value)->count())->toBe(1);
});

test('a duplicate name in one account is rejected but allowed across accounts', function () {
    $account = Account::factory()->create();
    Location::factory()->for($account)->create(['name' => 'Torre Mirador']);
    $admin = locationAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations", validLocationPayload())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);

    $otherAccount = Account::factory()->create();
    $otherAdmin = locationAdmin($otherAccount);

    $this->actingAs($otherAdmin)
        ->postJson("/api/accounts/{$otherAccount->id}/locations", validLocationPayload())
        ->assertCreated();
});

test('a name colliding with a soft-deleted location slug still creates with a distinct slug', function () {
    $account = Account::factory()->create();
    Location::factory()->for($account)->create(['name' => 'Torre Mirador', 'slug' => 'torre-mirador'])->delete();
    $admin = locationAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations", validLocationPayload())
        ->assertCreated()
        ->assertJsonPath('data.slug', 'torre-mirador-2');
});

test('renaming a location leaves its slug unchanged', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create(['name' => 'Edificio Central', 'slug' => 'edificio-central']);
    $admin = locationAdmin($account);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/locations/{$location->id}", ['name' => 'Edificio Renombrado'])
        ->assertOk()
        ->assertJsonPath('data.name', 'Edificio Renombrado')
        ->assertJsonPath('data.slug', 'edificio-central');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::LocationUpdated->value)->count())->toBe(1);
});

test('the list filters by status and type and carries tile counts', function () {
    $account = Account::factory()->create();
    $admin = locationAdmin($account);
    $active = Location::factory()->for($account)->create(['type' => LocationType::Condominium]);
    $retired = Location::factory()->for($account)->create();
    $retired->deactivate($admin);

    $response = $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations?status=active&type=condominium")
        ->assertOk();

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.id'))->toBe($active->id)
        ->and($response->json('data.0'))->toHaveKeys([
            'units_count', 'residents_count', 'vehicles_count',
            'staff_count', 'unclaimed_invitations_count', 'active_amenities_count',
        ]);

    $deactivatedList = $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations?status=deactivated")
        ->assertOk();

    expect($deactivatedList->json('data.0.id'))->toBe($retired->id)
        ->and($deactivatedList->json('data.0.status'))->toBe('deactivated');
});

test('a user from another account gets 404 on every route', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $outsider = locationAdmin(Account::factory()->create());

    $base = "/api/accounts/{$account->id}";

    $this->actingAs($outsider)->getJson("{$base}/locations")->assertNotFound();
    $this->actingAs($outsider)->postJson("{$base}/locations", validLocationPayload())->assertNotFound();
    $this->actingAs($outsider)->getJson("{$base}/locations/{$location->id}")->assertNotFound();
    $this->actingAs($outsider)->patchJson("{$base}/locations/{$location->id}", ['name' => 'X'])->assertNotFound();
    $this->actingAs($outsider)->postJson("{$base}/locations/{$location->id}/deactivate")->assertNotFound();
    $this->actingAs($outsider)->postJson("{$base}/locations/{$location->id}/reactivate")->assertNotFound();
    $this->actingAs($outsider)->getJson("{$base}/locations/{$location->id}/settings")->assertNotFound();
    $this->actingAs($outsider)->putJson("{$base}/locations/{$location->id}/settings", [])->assertNotFound();
    $this->actingAs($outsider)->getJson("{$base}/settings")->assertNotFound();
    $this->actingAs($outsider)->putJson("{$base}/settings", [])->assertNotFound();
});

test('a location reached through the wrong account 404s even for its own admin', function () {
    $accountA = Account::factory()->create();
    $accountB = Account::factory()->create();
    $locationB = Location::factory()->for($accountB)->create();
    $adminOfBoth = locationAdmin($accountA);
    createStaffMembership($accountB, $adminOfBoth, AccountRole::AccountAdmin);

    $this->actingAs($adminOfBoth)
        ->getJson("/api/accounts/{$accountA->id}/locations/{$locationB->id}")
        ->assertNotFound();
});

test('a location manager gets 403 on create, rename, and deactivate', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    Location::factory()->for($account)->create();
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $base = "/api/accounts/{$account->id}";

    $this->actingAs($manager)->postJson("{$base}/locations", validLocationPayload())->assertForbidden();
    $this->actingAs($manager)->patchJson("{$base}/locations/{$location->id}", ['name' => 'X'])->assertForbidden();
    $this->actingAs($manager)->postJson("{$base}/locations/{$location->id}/deactivate")->assertForbidden();
    $this->actingAs($manager)->getJson("{$base}/locations")->assertForbidden();
});

test('deactivating stamps who and when and clears the callers active location', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    Location::factory()->for($account)->create();
    $admin = locationAdmin($account);

    $this->actingAs($admin)->postJson('/api/context/account', ['account_id' => $account->id]);
    $this->actingAs($admin)->postJson('/api/context/location', ['location_id' => $location->id]);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations/{$location->id}/deactivate")
        ->assertOk()
        ->assertJsonPath('data.status', 'deactivated')
        ->assertJsonPath('data.deactivated_by.id', $admin->id);

    $me = $this->actingAs($admin)->getJson('/api/me');
    expect($me->json('active_location.id'))->not->toBe($location->id)
        ->and(collect($me->json('accessible_locations'))->pluck('id'))->not->toContain($location->id);

    expect(ActivityLog::query()->where('event_type', ActivityEventType::LocationDeactivated->value)->count())->toBe(1);
});

test('the last active location cannot be deactivated', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = locationAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations/{$location->id}/deactivate")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['location']);

    expect($location->refresh()->isDeactivated())->toBeFalse();
});

test('a deactivated location is read-only until reactivated', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    Location::factory()->for($account)->create();
    $admin = locationAdmin($account);
    $location->deactivate($admin);

    $base = "/api/accounts/{$account->id}/locations/{$location->id}";

    // Still visible to the admin surface, with deactivation metadata.
    $this->actingAs($admin)->getJson($base)->assertOk()->assertJsonPath('data.status', 'deactivated');
    // But every write except reactivate is refused.
    $this->actingAs($admin)->patchJson($base, ['name' => 'X'])->assertForbidden();
    $this->actingAs($admin)->postJson("{$base}/deactivate")->assertForbidden();
    $this->actingAs($admin)->putJson("{$base}/settings", ['quiet_hours_enabled' => true])->assertForbidden();

    $this->actingAs($admin)->postJson("{$base}/reactivate")->assertOk()->assertJsonPath('data.status', 'active');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::LocationReactivated->value)->count())->toBe(1);
});

test('a location manager can view the detail of an assigned location but not the admin list', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $other = Location::factory()->for($account)->create();
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $this->actingAs($manager)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}")
        ->assertOk();

    $this->actingAs($manager)
        ->getJson("/api/accounts/{$account->id}/locations/{$other->id}")
        ->assertForbidden();
});
