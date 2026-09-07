<?php

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('the expire lapsed subscriptions command only expires trialing or active rows past access_until', function () {
    $lapsedTrial = Subscription::factory()->create(['status' => SubscriptionStatus::Trialing, 'access_until' => now()->subMinute()]);
    $lapsedPaid = Subscription::factory()->create(['status' => SubscriptionStatus::Active, 'access_until' => now()->subMinute()]);
    $runningTrial = Subscription::factory()->create(['status' => SubscriptionStatus::Trialing, 'access_until' => now()->addDay()]);
    $alreadyExpired = Subscription::factory()->create(['status' => SubscriptionStatus::Expired, 'access_until' => now()->subMonth()]);

    $this->artisan('subscriptions:expire-lapsed')
        ->expectsOutput('Expired 2 lapsed subscription(s).')
        ->assertSuccessful();

    expect($lapsedTrial->fresh()->status)->toBe(SubscriptionStatus::Expired)
        ->and($lapsedPaid->fresh()->status)->toBe(SubscriptionStatus::Expired)
        ->and($runningTrial->fresh()->status)->toBe(SubscriptionStatus::Trialing)
        ->and($alreadyExpired->fresh()->status)->toBe(SubscriptionStatus::Expired);
});
