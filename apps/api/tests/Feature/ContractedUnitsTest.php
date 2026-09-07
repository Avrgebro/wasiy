<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\SubscriptionStatus;
use App\Models\Account;
use App\Models\Location;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Unit;
use App\Models\User;
use App\Services\UnitCapacity;
use Carbon\CarbonImmutable;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->travelTo('2026-09-14 09:00:00');
    $this->seed(PlanSeeder::class);
});

function cappedWorld(int $contracted = 12, int $active = 12): array
{
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);
    Subscription::factory()->for($account)->for(Plan::query()->where('code', 'operativo')->sole())->create([
        'status' => SubscriptionStatus::Active, 'billable_units' => $contracted, 'unit_price_minor' => 650,
        'trial_ends_at' => CarbonImmutable::parse('2026-08-21'), 'access_until' => CarbonImmutable::parse('2026-10-20 23:59:59'),
    ]);
    Unit::factory()->count($active)->for($account)->for($location)->create(['status' => RegistryStatus::Active]);

    return [$account, $location, $admin, $manager];
}

it('refuses to create or reactivate a unit past the contracted number', function () {
    [$account, $location, , $manager] = cappedWorld(12, 12);
    $inactive = Unit::factory()->for($account)->for($location)->create(['status' => RegistryStatus::Inactive, 'unit_number' => '901']);

    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/units", ['unit_number' => '1301', 'type' => 'apartment'])
        ->assertUnprocessable()->assertJsonValidationErrors([UnitCapacity::ERROR_KEY])
        ->assertJsonPath('errors.contracted_units.0', 'Llegaste al límite de tu plan (12 unidades). Amplía las unidades contratadas para registrar más.');
    $this->actingAs($manager)->postJson("/api/units/{$inactive->id}/reactivate")
        ->assertUnprocessable()->assertJsonValidationErrors([UnitCapacity::ERROR_KEY]);

    // One slot frees the way; deactivating never changes the bill.
    Unit::query()->where('account_id', $account->id)->where('status', RegistryStatus::Active->value)->first()->forceFill(['status' => RegistryStatus::Inactive])->save();
    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/units", ['unit_number' => '1301', 'type' => 'apartment'])->assertCreated();
    expect($account->subscription->fresh()->billable_units)->toBe(12);
});

it('accounts without a subscription have no cap', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/units", ['unit_number' => '101', 'type' => 'apartment'])->assertCreated();
});

it('raising the contracted units applies at once and cancels a scheduled decrease', function () {
    [$account, , $admin] = cappedWorld(12, 12);
    $account->subscription->forceFill(['pending_billable_units' => 10, 'pending_units_from' => '2026-10-20'])->save();

    $this->actingAs($admin)->patchJson('/api/account/subscription/units', ['units' => 20])
        ->assertOk()
        ->assertJsonPath('data.subscription.billable_units', 20)
        ->assertJsonPath('data.subscription.pending_billable_units', null)
        ->assertJsonPath('data.breakdown.total_minor', 13000);
});

it('lowering waits for the renewal, never below the plan floor or the active units', function () {
    [$account, , $admin] = cappedWorld(40, 37);

    $this->actingAs($admin)->patchJson('/api/account/subscription/units', ['units' => 38])
        ->assertOk()
        ->assertJsonPath('data.subscription.billable_units', 40)
        ->assertJsonPath('data.subscription.pending_billable_units', 38)
        ->assertJsonPath('data.subscription.pending_units_from', '2026-10-20');

    $this->actingAs($admin)->patchJson('/api/account/subscription/units', ['units' => 30])
        ->assertUnprocessable()->assertJsonValidationErrors(['units']);
    $this->actingAs($admin)->patchJson('/api/account/subscription/units', ['units' => 5])
        ->assertUnprocessable()->assertJsonPath('errors.units.0', 'El plan incluye 10 unidades; no puedes contratar menos.');

    // Back to the current number clears the schedule.
    $this->actingAs($admin)->patchJson('/api/account/subscription/units', ['units' => 40])
        ->assertOk()->assertJsonPath('data.subscription.pending_billable_units', null);
});

it('only the account admin can change the contracted units', function () {
    [, , , $manager] = cappedWorld();

    $this->actingAs($manager)->patchJson('/api/account/subscription/units', ['units' => 50])->assertForbidden();
});
