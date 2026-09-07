<?php

use App\Enums\AccountRole;
use App\Enums\Capability;
use App\Enums\LocationRole;
use App\Enums\SubscriptionStatus;
use App\Http\Middleware\EnsureSubscriptionIsActive;
use App\Models\Account;
use App\Models\Location;
use App\Models\Plan;
use App\Models\Resident;
use App\Models\Subscription;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function adminOf(Account $account): User
{
    $user = User::factory()->create();
    createStaffMembership($account, $user, AccountRole::AccountAdmin);

    return $user;
}

test('/api/me carries the active account subscription with the countdown', function () {
    $this->travelTo('2026-09-07 12:00:00');
    $account = Account::factory()->create();
    $plan = Plan::factory()->create(['code' => 'operativo', 'name' => 'Operativo']);
    Subscription::factory()->for($account)->for($plan)->create([
        'trial_ends_at' => now()->addDays(5)->addHours(3),
        'access_until' => now()->addDays(5)->addHours(3),
        'billable_units' => 40,
        'unit_price_minor' => 650,
    ]);

    $this->actingAs(adminOf($account))
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.subscription.status', 'trialing')
        ->assertJsonPath('active_account.subscription.plan.code', 'operativo')
        ->assertJsonPath('active_account.subscription.plan.name', 'Operativo')
        ->assertJsonPath('active_account.subscription.billable_units', 40)
        ->assertJsonPath('active_account.subscription.unit_price_minor', 650)
        ->assertJsonPath('active_account.subscription.days_left', 6)
        ->assertJsonPath('active_account.subscription.is_lapsed', false)
        ->assertJsonPath('accounts.0.subscription.days_left', 6)
        ->assertJsonPath('active_account.subscription.contact_email', config('wasiy.leads.notify_email'))
        ->assertJsonPath('accounts.0.subscription.trial_ends_at', now()->addDays(5)->addHours(3)->toIso8601String());
});

test('only account admins hold the subscription capability', function () {
    expect(Capability::valuesForRoles(true, null))->toContain('subscription.manage')
        ->and(Capability::valuesForRoles(false, LocationRole::LocationManager))->not->toContain('subscription.manage')
        ->and(Capability::valuesForRoles(false, LocationRole::FrontDesk))->not->toContain('subscription.manage');
});

test('accounts without a subscription report null and are not gated', function () {
    $account = Account::factory()->create();

    $this->actingAs(adminOf($account))
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.subscription', null);

    $this->actingAs(adminOf($account))
        ->getJson("/api/accounts/{$account->id}/settings")
        ->assertOk();
});

test('staff endpoints answer 402 once the subscription lapses while /api/me and context stay reachable', function () {
    $account = Account::factory()->create();
    Location::factory()->for($account)->create();
    Subscription::factory()->for($account)->create([
        'trial_ends_at' => now()->subMinute(),
        'access_until' => now()->subMinute(),
    ]);
    $admin = adminOf($account);

    $this->actingAs($admin)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.subscription.is_lapsed', true)
        ->assertJsonPath('active_account.subscription.days_left', 0);

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/settings")
        ->assertStatus(402)
        ->assertJsonPath('code', EnsureSubscriptionIsActive::ERROR_CODE);

    $this->actingAs($admin)
        ->postJson('/api/context/account', ['account_id' => $account->id])
        ->assertOk();
});

test('the gate reads access_until, not the status, so an unexpired row still lapses on time', function () {
    $account = Account::factory()->create();
    Subscription::factory()->for($account)->create([
        'status' => SubscriptionStatus::Trialing,
        'access_until' => now()->subSecond(),
    ]);

    $this->actingAs(adminOf($account))
        ->getJson("/api/accounts/{$account->id}/settings")
        ->assertStatus(402);
});

test('a paid extension reopens access', function () {
    $account = Account::factory()->create();
    Subscription::factory()->for($account)->create([
        'status' => SubscriptionStatus::Active,
        'trial_ends_at' => now()->subDays(10),
        'access_until' => now()->addMonth(),
    ]);

    $this->actingAs(adminOf($account))
        ->getJson("/api/accounts/{$account->id}/settings")
        ->assertOk();
});

test('the resident portal is never gated by a lapsed staff subscription', function () {
    $user = User::factory()->create();
    $location = Location::factory()->create();
    Subscription::factory()->for($location->account)->create([
        'access_until' => now()->subDay(),
    ]);
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $resident = Resident::factory()->for($location->account)->for($user)->create();
    UnitMembership::factory()->for($resident)->for($unit)->for($location->account)->for($location)->create();

    $this->actingAs($user)
        ->withSession(['wasiy.active_account_id' => $location->account_id])
        ->getJson('/api/portal/resident')
        ->assertOk();
});
