<?php

use App\Enums\AccountRole;
use App\Enums\SubscriptionStatus;
use App\Models\Account;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\BillingNoticeNotification;
use Carbon\CarbonImmutable;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(PlanSeeder::class);
    Notification::fake();
    config()->set('wasiy.billing.review_email', 'cobros@wasiy.test');
});

it('records the requested plan, tells the team and the admin, and can be withdrawn', function () {
    $account = Account::factory()->create(['name' => 'Horizonte']);
    $admin = User::factory()->create(['email' => 'ana@horizonte.pe']);
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);
    $subscription = Subscription::factory()->for($account)->for(Plan::query()->where('code', 'operativo')->sole())->create([
        'status' => SubscriptionStatus::Active, 'billable_units' => 40, 'access_until' => CarbonImmutable::parse('2026-10-20 23:59:59'),
    ]);

    $this->actingAs($admin)->postJson('/api/account/subscription/plan-change-request', ['plan' => 'operativo'])
        ->assertUnprocessable()->assertJsonValidationErrors(['plan']);

    $this->actingAs($admin)->postJson('/api/account/subscription/plan-change-request', ['plan' => 'esencial'])
        ->assertOk()
        ->assertJsonPath('data.subscription.requested_plan.code', 'esencial')
        ->assertJsonPath('data.plan.code', 'operativo');
    expect($subscription->fresh()->requested_plan_id)->toBe(Plan::query()->where('code', 'esencial')->sole()->id);

    $titles = [];
    Notification::assertSentOnDemand(BillingNoticeNotification::class, function (BillingNoticeNotification $n, array $channels, AnonymousNotifiable $notifiable) use (&$titles) {
        $titles[] = $n->title.'→'.implode(',', (array) $notifiable->routes['mail']);

        return true;
    });
    expect($titles)->toContain('Solicitud de cambio de plan→cobros@wasiy.test')->toContain('Solicitud recibida→ana@horizonte.pe');

    $this->actingAs($admin)->postJson('/api/account/subscription/plan-change-request', ['plan' => null])
        ->assertOk()->assertJsonPath('data.subscription.requested_plan', null);
});
