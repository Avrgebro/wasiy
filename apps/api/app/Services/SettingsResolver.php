<?php

namespace App\Services;

use App\Data\OperationalSettings;
use App\Models\Account;
use App\Models\Location;

/**
 * The single owner of the Account → Location settings cascade. Each level
 * stores only the keys it overrides; every read resolves through the chain
 * to one effective value. Reservation policy is not part of it (ADR 0041).
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
