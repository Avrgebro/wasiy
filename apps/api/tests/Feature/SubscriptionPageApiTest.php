<?php

use App\Actions\Billing\IssueInvoice;
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
use Carbon\CarbonImmutable;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->travelTo('2026-09-14 09:00:00');
    $this->seed(PlanSeeder::class);
    config()->set('wasiy.billing.transfer.account_number', '193-2547891-0-45');
    config()->set('wasiy.billing.transfer.cci', '002-193-002547891045-19');
    config()->set('wasiy.billing.yape.number', '987654321');
    config()->set('wasiy.billing.plin.number', null);
});

function billingWorld(): array
{
    $account = Account::factory()->create(['name' => 'Administradora Horizonte']);
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);
    $subscription = Subscription::factory()->for($account)->for(Plan::query()->where('code', 'operativo')->sole())->create([
        'status' => SubscriptionStatus::Trialing, 'billable_units' => 40, 'unit_price_minor' => 650,
        'trial_ends_at' => CarbonImmutable::parse('2026-09-21 12:00:00'), 'access_until' => CarbonImmutable::parse('2026-09-21 12:00:00'),
        'pending_billable_units' => 30, 'pending_units_from' => CarbonImmutable::parse('2026-10-21'),
    ]);
    Unit::factory()->count(3)->for($account)->for($location)->create(['status' => RegistryStatus::Active]);
    Unit::factory()->for($account)->for($location)->create(['status' => RegistryStatus::Inactive]);

    return [$account, $admin, $subscription];
}

it('gives the account admin the whole subscription page in one payload', function () {
    [$account, $admin, $subscription] = billingWorld();
    $invoice = app(IssueInvoice::class)->handle($subscription);

    $this->actingAs($admin)
        ->getJson('/api/account/subscription')
        ->assertOk()
        ->assertJsonPath('data.account.name', 'Administradora Horizonte')
        ->assertJsonPath('data.plan.code', 'operativo')
        ->assertJsonPath('data.plan.included_units', 10)
        ->assertJsonPath('data.subscription.status', 'trialing')
        ->assertJsonPath('data.subscription.billable_units', 40)
        ->assertJsonPath('data.subscription.units_in_use', 3)
        ->assertJsonPath('data.subscription.pending_billable_units', 30)
        ->assertJsonPath('data.subscription.pending_units_from', '2026-10-21')
        ->assertJsonPath('data.subscription.days_left', 8)
        ->assertJsonPath('data.breakdown.base_minor', 6500)
        ->assertJsonPath('data.breakdown.extra_units', 30)
        ->assertJsonPath('data.breakdown.extra_minor', 19500)
        ->assertJsonPath('data.breakdown.total_minor', 26000)
        ->assertJsonCount(1, 'data.invoices')
        ->assertJsonPath('data.invoices.0.number', $invoice->number)
        ->assertJsonPath('data.invoices.0.status', 'pending')
        ->assertJsonPath('data.invoices.0.amount_minor', 26000)
        ->assertJsonPath('data.payment_instructions.transfer.account_number', '193-2547891-0-45')
        ->assertJsonPath('data.payment_instructions.yape.number', '987654321')
        ->assertJsonPath('data.payment_instructions.plin', null)
        ->assertJsonPath('data.plans.0.code', 'esencial')
        ->assertJsonPath('data.plans.0.total_minor', 18000)
        ->assertJsonPath('data.plans.0.is_current', false)
        ->assertJsonPath('data.plans.1.code', 'operativo')
        ->assertJsonPath('data.plans.1.total_minor', 26000)
        ->assertJsonPath('data.plans.1.is_current', true);
});

it('stays readable after the account lapses and is admin-only', function () {
    [$account, $admin, $subscription] = billingWorld();
    $subscription->forceFill(['access_until' => now()->subDay()])->save();
    $desk = User::factory()->create();
    grantLocationRole($account, Location::query()->where('account_id', $account->id)->sole(), $desk, LocationRole::FrontDesk);

    $this->actingAs($admin)->getJson('/api/account/subscription')->assertOk()->assertJsonPath('data.subscription.is_lapsed', true);
    $this->actingAs($desk)->getJson('/api/account/subscription')->assertForbidden();
});

it('returns null for accounts without a subscription', function () {
    $account = Account::factory()->create();
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    $this->actingAs($admin)->getJson('/api/account/subscription')->assertOk()->assertJsonPath('data', null);
});
