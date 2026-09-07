<?php

namespace App\Services;

use App\Enums\RegistryStatus;
use App\Models\Account;
use App\Models\Unit;
use Illuminate\Validation\ValidationException;

/**
 * The contracted units are a hard cap on active units (ADR 0040): creating or
 * reactivating a unit past the cap fails with the message the subscription
 * page turns into "Ampliar unidades". Accounts without a subscription have no
 * cap. Counting only restricts, never discounts, so it is safe to count here.
 */
class UnitCapacity
{
    public const ERROR_KEY = 'contracted_units';

    public function activeUnits(Account $account): int
    {
        return Unit::query()->where('account_id', $account->id)->where('status', RegistryStatus::Active->value)->count();
    }

    public function assertCanActivate(Account $account): void
    {
        $cap = $account->subscription?->billable_units;
        if ($cap === null) {
            return;
        }

        if ($this->activeUnits($account) >= $cap) {
            throw ValidationException::withMessages([
                self::ERROR_KEY => "Llegaste al límite de tu plan ({$cap} unidades). Amplía las unidades contratadas para registrar más.",
            ]);
        }
    }
}
