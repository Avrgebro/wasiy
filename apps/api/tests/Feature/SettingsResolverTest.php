<?php

use App\Data\OperationalSettings;
use App\Models\Location;
use App\Services\SettingsResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function resolver(): SettingsResolver
{
    return app(SettingsResolver::class);
}

test('null settings at both levels resolve to system defaults', function () {
    $location = Location::factory()->create();

    expect($location->settings)->toBeNull()
        ->and($location->account->settings)->toBeNull()
        ->and(resolver()->forLocation($location)->toArray())
        ->toBe(OperationalSettings::defaults()->toArray());
});

test('a location override wins over an account value', function () {
    $location = Location::factory()->create();
    $location->account->forceFill(['settings' => ['reservation_max_advance_days' => 60]])->save();
    $location->forceFill(['settings' => ['reservation_max_advance_days' => 15]])->save();

    expect(resolver()->forLocation($location)->reservationMaxAdvanceDays)->toBe(15)
        ->and(resolver()->forAccount($location->account)->reservationMaxAdvanceDays)->toBe(60);
});

test('a key absent at the location inherits the account value and follows it', function () {
    $location = Location::factory()->create();
    $account = $location->account;
    $account->forceFill(['settings' => ['visitor_auto_checkout_hours' => 24]])->save();

    expect(resolver()->forLocation($location)->visitorAutoCheckoutHours)->toBe(24);

    $account->forceFill(['settings' => ['visitor_auto_checkout_hours' => 8]])->save();

    expect(resolver()->forLocation($location->refresh())->visitorAutoCheckoutHours)->toBe(8);
});

test('a location key set to the same value as the account does not follow a later account change', function () {
    $location = Location::factory()->create();
    $account = $location->account;
    $account->forceFill(['settings' => ['reservation_cancellation_window_hours' => 24]])->save();
    $location->forceFill(['settings' => ['reservation_cancellation_window_hours' => 24]])->save();

    $account->forceFill(['settings' => ['reservation_cancellation_window_hours' => 48]])->save();

    expect(resolver()->forLocation($location->refresh())->reservationCancellationWindowHours)->toBe(24);
});

test('a zero auto checkout override means never and is an override, not inheritance', function () {
    $location = Location::factory()->create();
    $location->account->forceFill(['settings' => ['visitor_auto_checkout_hours' => 24]])->save();
    $location->forceFill(['settings' => ['visitor_auto_checkout_hours' => 0]])->save();

    expect(resolver()->forLocation($location)->visitorAutoCheckoutHours)->toBe(0)
        ->and(resolver()->explain($location)['visitor_auto_checkout_hours']['source'])->toBe('location');
});

test('explain reports the correct source level per key', function () {
    $location = Location::factory()->create();
    $location->account->forceFill(['settings' => ['reservation_max_advance_days' => 60]])->save();
    $location->forceFill(['settings' => ['quiet_hours_enabled' => true, 'quiet_hours_start' => '22:00', 'quiet_hours_end' => '07:00']])->save();

    $explained = resolver()->explain($location);

    expect($explained['quiet_hours_enabled'])->toBe(['value' => true, 'source' => 'location', 'account_value' => false])
        ->and($explained['reservation_max_advance_days'])->toBe(['value' => 60, 'source' => 'account', 'account_value' => 60])
        ->and($explained['announcements_email_residents'])->toBe(['value' => false, 'source' => 'default', 'account_value' => false])
        ->and(array_keys($explained))->toBe(array_keys(OperationalSettings::DEFAULTS));
});

test('an unknown key is rejected', function () {
    OperationalSettings::resolve(['front_desk_theme' => 'dark']);
})->throws(InvalidArgumentException::class, 'Unknown operational setting [front_desk_theme].');

test('an invalid value is rejected', function (string $key, mixed $value) {
    OperationalSettings::resolve([$key => $value]);
})->with([
    'negative advance days' => ['reservation_max_advance_days', -1],
    'boolean as int' => ['visitor_preregistration_enabled', 1],
    'malformed quiet hours time' => ['quiet_hours_start', '25:00'],
    'negative auto checkout hours' => ['visitor_auto_checkout_hours', -1],
    'null quiet hours in a stored layer' => ['quiet_hours_start', null],
])->throws(InvalidArgumentException::class);

test('quiet hours accept a valid time and default to null', function () {
    $settings = OperationalSettings::resolve(['quiet_hours_start' => '22:00']);

    expect($settings->quietHoursStart)->toBe('22:00')
        ->and($settings->quietHoursEnd)->toBeNull();
});
