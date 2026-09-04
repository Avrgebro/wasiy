<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\Package;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Notifications\PackageReceivedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

/**
 * @return array{Account, Location, Unit, User}
 */
function packageWorld(): array
{
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create(['timezone' => 'America/Lima']);
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_number' => '402', 'building_name' => 'Torre A']);
    $frontDesk = User::factory()->create();
    createStaffMembership($account, $frontDesk);
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);

    return [$account, $location, $unit, $frontDesk];
}

function memberOf(Unit $unit, array $resident = [], bool $primary = false): Resident
{
    $person = Resident::factory()->create(['account_id' => $unit->account_id, ...$resident]);
    UnitMembership::factory()->create([
        'account_id' => $unit->account_id, 'location_id' => $unit->location_id, 'unit_id' => $unit->id, 'resident_id' => $person->id,
        'resident_type' => ResidentType::Owner, 'status' => RegistryStatus::Active, 'is_primary_contact' => $primary,
    ]);

    return $person;
}

test('front desk registers a package for a named resident, who is notified', function () {
    Notification::fake();
    [$account, $location, $unit, $frontDesk] = packageWorld();
    $carlos = memberOf($unit, ['first_name' => 'Carlos', 'last_name' => 'Mendoza', 'email' => 'carlos@x.pe'], primary: true);
    $laura = memberOf($unit, ['first_name' => 'Laura', 'last_name' => 'Mendoza', 'email' => 'laura@x.pe']);

    $response = $this->actingAs($frontDesk)
        ->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id, 'resident_id' => $laura->id, 'notes' => 'Caja mediana, frágil'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.unit_number', '402')
        ->assertJsonPath('data.resident_name', 'Laura Mendoza')
        ->assertJsonPath('data.received_by_name', $frontDesk->name)
        ->assertJsonPath('data.notified_email', 'laura@x.pe');

    Notification::assertSentOnDemand(PackageReceivedNotification::class, fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'laura@x.pe');
    Notification::assertCount(1);
    expect(ActivityLog::query()->where('event_type', ActivityEventType::PackageReceived->value)->where('subject_id', $response->json('data.id'))->exists())->toBeTrue()
        ->and($carlos->email)->toBe('carlos@x.pe');
});

test('without a named resident the primary contact is notified, and nobody when there is no email', function () {
    Notification::fake();
    [$account, $location, $unit, $frontDesk] = packageWorld();
    memberOf($unit, ['first_name' => 'Carlos', 'last_name' => 'Mendoza', 'email' => 'carlos@x.pe'], primary: true);

    $this->actingAs($frontDesk)
        ->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id])
        ->assertCreated()
        ->assertJsonPath('data.resident_id', null)
        ->assertJsonPath('data.notified_email', 'carlos@x.pe');
    Notification::assertSentOnDemand(PackageReceivedNotification::class);

    $silent = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_number' => '305']);
    memberOf($silent, ['email' => null], primary: true);
    $this->actingAs($frontDesk)
        ->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $silent->id])
        ->assertCreated()
        ->assertJsonPath('data.notified_email', null);
    Notification::assertCount(1);
});

test('the unit must be active in the location and the person must live there', function () {
    [$account, $location, $unit, $frontDesk] = packageWorld();
    $other = Location::factory()->for($account)->create();
    $foreignUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $other->id]);
    $stranger = Resident::factory()->create(['account_id' => $account->id]);

    $this->actingAs($frontDesk)
        ->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $foreignUnit->id])
        ->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($frontDesk)
        ->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id, 'resident_id' => $stranger->id])
        ->assertUnprocessable()->assertJsonValidationErrors('resident_id');

    $outsider = User::factory()->create();
    $this->actingAs($outsider)->getJson("/api/locations/{$location->id}/packages")->assertForbidden();
});

test('delivery is one way and recorded', function () {
    [$account, $location, $unit, $frontDesk] = packageWorld();
    $package = Package::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'received_by' => $frontDesk->id]);

    $this->actingAs($frontDesk)
        ->postJson("/api/packages/{$package->id}/deliver", ['delivered_to' => 'Laura Mendoza'])
        ->assertOk()
        ->assertJsonPath('data.status', 'delivered')
        ->assertJsonPath('data.delivered_to', 'Laura Mendoza')
        ->assertJsonPath('data.delivered_by_name', $frontDesk->name);

    $this->actingAs($frontDesk)
        ->postJson("/api/packages/{$package->id}/deliver")
        ->assertUnprocessable()->assertJsonValidationErrors('status');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::PackageDelivered->value)->where('subject_id', $package->id)->count())->toBe(1);
});

test('the list filters by status and searches unit and resident, and the unit shows its pending packages', function () {
    [$account, $location, $unit, $frontDesk] = packageWorld();
    $laura = memberOf($unit, ['first_name' => 'Laura', 'last_name' => 'Mendoza']);
    $other = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_number' => '609', 'building_name' => 'Torre B']);
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    Package::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $laura->id, 'received_by' => $frontDesk->id, 'received_at' => now()->subHour()]);
    Package::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $other->id, 'received_by' => $frontDesk->id, 'received_at' => now()]);
    Package::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $other->id, 'received_by' => $frontDesk->id, 'status' => 'delivered', 'received_at' => now()->subDay()]);

    $base = "/api/locations/{$location->id}/packages";
    $this->actingAs($admin)->getJson($base)->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('data.0.unit_number', '609');
    $this->actingAs($admin)->getJson("{$base}?status=pending")->assertJsonCount(2, 'data');
    $this->actingAs($admin)->getJson("{$base}?status=delivered")->assertJsonCount(1, 'data');
    $this->actingAs($admin)->getJson("{$base}?search=laura")->assertJsonCount(1, 'data')->assertJsonPath('data.0.resident_name', 'Laura Mendoza');
    $this->actingAs($admin)->getJson("{$base}?search=torre b")->assertJsonCount(2, 'data');

    $this->actingAs($frontDesk)->getJson("/api/units/{$other->id}")->assertOk()->assertJsonCount(1, 'packages')->assertJsonPath('packages.0.status', 'pending');
});
