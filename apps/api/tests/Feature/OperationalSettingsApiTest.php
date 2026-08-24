<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function settingsAdmin(Account $account): User
{
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return $admin;
}

test('location settings resolve through the account with per-key sources', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = settingsAdmin($account);
    $account->forceFill(['settings' => ['visitor_auto_checkout_hours' => 24]])->save();
    $location->forceFill(['settings' => ['visitor_auto_checkout_hours' => 12]])->save();

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}/settings")
        ->assertOk()
        ->assertJsonPath('data.values.visitor_auto_checkout_hours', 12)
        ->assertJsonPath('data.explanation.visitor_auto_checkout_hours.source', 'location')
        ->assertJsonPath('data.explanation.visitor_auto_checkout_hours.account_value', 24)
        ->assertJsonPath('data.explanation.reservation_max_advance_days.source', 'default');
});

test('a put merges per key and null clears an override back to inherited', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = settingsAdmin($account);
    $account->forceFill(['settings' => ['visitor_auto_checkout_hours' => 24]])->save();
    $location->forceFill(['settings' => [
        'visitor_auto_checkout_hours' => 12,
        'quiet_hours_enabled' => true,
    ]])->save();

    // One group saves without touching the other group's override.
    $this->actingAs($admin)
        ->putJson("/api/accounts/{$account->id}/locations/{$location->id}/settings", [
            'visitor_auto_checkout_hours' => null,
        ])
        ->assertOk()
        ->assertJsonPath('data.values.visitor_auto_checkout_hours', 24)
        ->assertJsonPath('data.explanation.visitor_auto_checkout_hours.source', 'account')
        ->assertJsonPath('data.values.quiet_hours_enabled', true);

    expect($location->refresh()->settings)->toBe(['quiet_hours_enabled' => true]);
});

test('zero auto checkout is a real override meaning never, distinct from null', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = settingsAdmin($account);
    $account->forceFill(['settings' => ['visitor_auto_checkout_hours' => 24]])->save();

    $this->actingAs($admin)
        ->putJson("/api/accounts/{$account->id}/locations/{$location->id}/settings", [
            'visitor_auto_checkout_hours' => 0,
        ])
        ->assertOk()
        ->assertJsonPath('data.values.visitor_auto_checkout_hours', 0)
        ->assertJsonPath('data.explanation.visitor_auto_checkout_hours.source', 'location');
});

test('unknown keys and invalid values are rejected', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = settingsAdmin($account);

    $this->actingAs($admin)
        ->putJson("/api/accounts/{$account->id}/locations/{$location->id}/settings", [
            'front_desk_theme' => 'dark',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['front_desk_theme']);

    $this->actingAs($admin)
        ->putJson("/api/accounts/{$account->id}/locations/{$location->id}/settings", [
            'quiet_hours_start' => '25:00',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['quiet_hours_start']);
});

test('a location manager can read and update settings for an assigned location only', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $other = Location::factory()->for($account)->create();
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $base = "/api/accounts/{$account->id}/locations";

    $this->actingAs($manager)->getJson("{$base}/{$location->id}/settings")->assertOk();
    $this->actingAs($manager)
        ->putJson("{$base}/{$location->id}/settings", ['reservation_max_advance_days' => 15])
        ->assertOk()
        ->assertJsonPath('data.values.reservation_max_advance_days', 15);

    $this->actingAs($manager)->getJson("{$base}/{$other->id}/settings")->assertForbidden();
    $this->actingAs($manager)->putJson("{$base}/{$other->id}/settings", [])->assertForbidden();
});

test('account settings are admin only and a manager gets 403', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = settingsAdmin($account);
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $this->actingAs($manager)->getJson("/api/accounts/{$account->id}/settings")->assertForbidden();
    $this->actingAs($manager)->putJson("/api/accounts/{$account->id}/settings", [])->assertForbidden();

    $this->actingAs($admin)
        ->putJson("/api/accounts/{$account->id}/settings", ['reservation_max_advance_days' => 60])
        ->assertOk()
        ->assertJsonPath('data.values.reservation_max_advance_days', 60)
        ->assertJsonPath('data.explanation.reservation_max_advance_days.source', 'account')
        ->assertJsonPath('data.explanation.quiet_hours_enabled.source', 'default');

    // The location now inherits the new account default.
    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}/settings")
        ->assertOk()
        ->assertJsonPath('data.values.reservation_max_advance_days', 60)
        ->assertJsonPath('data.explanation.reservation_max_advance_days.source', 'account');
});

test('every settings mutation writes exactly one activity entry', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = settingsAdmin($account);

    $this->actingAs($admin)
        ->putJson("/api/accounts/{$account->id}/locations/{$location->id}/settings", ['quiet_hours_enabled' => true])
        ->assertOk();
    $this->actingAs($admin)
        ->putJson("/api/accounts/{$account->id}/settings", ['reservation_max_advance_days' => 60])
        ->assertOk();

    expect(ActivityLog::query()->where('event_type', ActivityEventType::LocationSettingsChanged->value)->count())->toBe(1)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::AccountSettingsChanged->value)->count())->toBe(1);
});
