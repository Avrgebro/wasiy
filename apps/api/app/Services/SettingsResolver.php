<?php

namespace App\Services;

use App\Data\OperationalSettings;
use App\Models\Account;
use App\Models\Amenity;
use App\Models\Location;

/**
 * The single owner of the Account → Location settings cascade. Each level
 * stores only the keys it overrides; every read resolves through the chain
 * to one effective value. The Amenity level joins this chain in M6 slice 8.
 */
class SettingsResolver
{
    public function forAccount(Account $account): OperationalSettings
    {
        return OperationalSettings::resolve($account->settings ?? []);
    }

    public function forLocation(Location $location): OperationalSettings
    {
        return OperationalSettings::resolve(
            $location->account->settings ?? [],
            $location->settings ?? [],
        );
    }

    /**
     * The Amenity level of the cascade. An Amenity's nullable policy columns
     * inherit from its Location's resolved settings, so the reservations
     * milestone reads one effective value and never re-implements the
     * fallback.
     *
     * @return array<string, array{value: int, source: 'amenity'|'location'}>
     */
    public function bookingPolicyFor(Amenity $amenity): array
    {
        $locationSettings = $this->forLocation($amenity->location);

        $inherited = [
            'max_advance_days' => $locationSettings->reservationMaxAdvanceDays,
            'max_concurrent_per_unit' => $locationSettings->reservationMaxConcurrentPerUnit,
            'cancellation_window_hours' => $locationSettings->reservationCancellationWindowHours,
        ];

        $policy = [];

        foreach ($inherited as $key => $locationValue) {
            $own = $amenity->{$key};
            $policy[$key] = [
                'value' => $own ?? $locationValue,
                'source' => $own === null ? 'location' : 'amenity',
            ];
        }

        return $policy;
    }

    /**
     * Per key: the effective value, the level it came from, and the value the
     * Account level would have given. The Configuración tab renders its
     * "En vigencia … · valor de la cuenta …" lines straight from this, so the
     * frontend never re-implements the cascade.
     *
     * @return array<string, array{value: mixed, source: 'location'|'account'|'default', account_value: mixed}>
     */
    public function explain(Location $location): array
    {
        $accountOverrides = $location->account->settings ?? [];
        $locationOverrides = $location->settings ?? [];

        $accountValues = OperationalSettings::resolve($accountOverrides)->toArray();
        $effectiveValues = OperationalSettings::resolve($accountOverrides, $locationOverrides)->toArray();

        $explained = [];

        foreach (array_keys(OperationalSettings::DEFAULTS) as $key) {
            $explained[$key] = [
                'value' => $effectiveValues[$key],
                'source' => match (true) {
                    array_key_exists($key, $locationOverrides) => 'location',
                    array_key_exists($key, $accountOverrides) => 'account',
                    default => 'default',
                },
                'account_value' => $accountValues[$key],
            ];
        }

        return $explained;
    }
}
