<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Models\Account;
use App\Models\Location;
use App\Models\Package;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Notifications\ResidentInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

/**
 * @return array{Account, Location, User, User}
 */
function directoryWorld(): array
{
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);
    $frontDesk = User::factory()->create();
    createStaffMembership($account, $frontDesk);
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);

    return [$account, $location, $manager, $frontDesk];
}

function person(Location $location, string $first, string $last, array $attributes = []): Resident
{
    // No random phone or email: the search box matches both, and a factory
    // phone that happens to contain a unit number makes the search tests flaky.
    return Resident::factory()->create(['account_id' => $location->account_id, 'first_name' => $first, 'last_name' => $last, 'phone' => null, 'email' => null, ...$attributes]);
}

function livesIn(Resident $resident, Unit $unit, bool $active = true, bool $primary = false): UnitMembership
{
    return UnitMembership::factory()->create([
        'account_id' => $unit->account_id, 'location_id' => $unit->location_id, 'unit_id' => $unit->id, 'resident_id' => $resident->id,
        'status' => $active ? RegistryStatus::Active : RegistryStatus::Inactive, 'is_primary_contact' => $primary,
        'ended_at' => $active ? null : now()->toDateString(),
    ]);
}

test('the directory filters by portal state and "sin unidad", and searches by unit number', function () {
    [$account, $location, $manager] = directoryWorld();
    $u402 = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_number' => '402']);
    $u118 = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_number' => '118']);

    $carlos = person($location, 'Carlos', 'Mendoza', ['user_id' => User::factory()->create()->id]);
    livesIn($carlos, $u402, primary: true);
    livesIn($carlos, $u118);
    $lucia = person($location, 'Lucía', 'Ramírez');
    livesIn($lucia, $u118);
    $rodrigo = person($location, 'Rodrigo', 'Salas');
    livesIn($rodrigo, $u402, active: false);
    $ana = person($location, 'Ana', 'Torres', ['status' => RegistryStatus::Inactive]);
    livesIn($ana, $u118);

    $base = "/api/accounts/{$account->id}/residents?location_id={$location->id}";
    $names = fn (string $query = ''): array => collect($this->actingAs($manager)->getJson($base.$query)->assertOk()->json('data'))->pluck('last_name')->sort()->values()->all();

    // Deactivated people are left out unless asked for, as with units.
    expect($names())->toBe(['Mendoza', 'Ramírez', 'Salas'])
        ->and($names('&status=inactive'))->toBe(['Torres'])
        ->and($names('&portal=active'))->toBe(['Mendoza'])
        ->and($names('&portal=not_invited'))->toBe(['Ramírez', 'Salas'])
        ->and($names('&search=118'))->toBe(['Mendoza', 'Ramírez'])
        ->and($names('&search=402'))->toBe(['Mendoza']);

    $row = collect($this->actingAs($manager)->getJson($base)->json('data'))->firstWhere('last_name', 'Mendoza');
    expect($row['portal_state'])->toBe('active')->and($row['active_membership_count'])->toBe(2)
        ->and(collect($row['memberships'])->firstWhere('is_primary_contact', true)['unit']['unit_number'])->toBe('402');
});

test('front desk sees phones but never emails; managers and the person themselves see the email', function () {
    [$account, $location, $manager, $frontDesk] = directoryWorld();
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $carlos = person($location, 'Carlos', 'Mendoza', ['email' => 'carlos@x.pe', 'phone' => '+51 987 654 321']);
    livesIn($carlos, $unit);

    $this->actingAs($frontDesk)->getJson("/api/accounts/{$account->id}/residents?location_id={$location->id}")
        ->assertOk()
        ->assertJsonPath('data.0.phone', '+51 987 654 321')
        ->assertJsonMissingPath('data.0.email');
    $this->actingAs($manager)->getJson("/api/accounts/{$account->id}/residents?location_id={$location->id}")
        ->assertOk()->assertJsonPath('data.0.email', 'carlos@x.pe');
});

test('show returns the history that concerns the person', function () {
    [$account, $location, $manager, $frontDesk] = directoryWorld();
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $carlos = person($location, 'Carlos', 'Mendoza');
    livesIn($carlos, $unit);

    // A package addressed to Carlos, registered by the desk, mentions him in metadata.
    $this->actingAs($frontDesk)
        ->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id, 'resident_id' => $carlos->id])
        ->assertCreated();
    $this->actingAs($manager)->patchJson("/api/residents/{$carlos->id}", ['phone' => '+51 900 000 000'])->assertOk();

    $this->actingAs($manager)->getJson("/api/residents/{$carlos->id}")
        ->assertOk()
        ->assertJsonPath('data.first_name', 'Carlos')
        ->assertJsonCount(2, 'history')
        ->assertJsonPath('history.0.event_type', 'resident.updated')
        ->assertJsonPath('history.1.event_type', 'package.received');
});

test('inviting stores the email given at that moment, and deactivation needs no active membership', function () {
    Notification::fake();
    [$account, $location, $manager] = directoryWorld();
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);
    $carlos = person($location, 'Carlos', 'Mendoza', ['email' => null]);
    $membership = livesIn($carlos, $unit);

    $this->actingAs($manager)
        ->postJson("/api/residents/{$carlos->id}/invitations", ['email' => 'Carlos@X.pe'])
        ->assertCreated();
    expect($carlos->fresh()->email)->toBe('carlos@x.pe');
    Notification::assertSentOnDemand(ResidentInvitationNotification::class);

    $this->actingAs($manager)->postJson("/api/residents/{$carlos->id}/deactivate")
        ->assertUnprocessable()->assertJsonValidationErrors('status');

    $membership->forceFill(['status' => RegistryStatus::Inactive, 'ended_at' => now()->toDateString()])->save();
    $this->actingAs($manager)->postJson("/api/residents/{$carlos->id}/deactivate")
        ->assertOk()->assertJsonPath('data.status', 'inactive');
    $this->actingAs($manager)->postJson("/api/residents/{$carlos->id}/reactivate")
        ->assertOk()->assertJsonPath('data.status', 'active');

    expect(Package::query()->count())->toBe(0)->and(AccountRole::AccountAdmin->value)->toBe('account_admin');
});
