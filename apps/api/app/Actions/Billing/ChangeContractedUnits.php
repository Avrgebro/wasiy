<?php

namespace App\Actions\Billing;

use App\Models\Subscription;
use App\Services\UnitCapacity;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Ampliar unidades" (ADR 0040). Raising the contracted number applies at
 * once and the difference lands on the next invoice; lowering it is
 * scheduled for the next renewal and only if the active units fit. Setting
 * the current number again cancels a scheduled decrease.
 */
class ChangeContractedUnits
{
    public function __construct(private readonly UnitCapacity $capacity) {}

    public function handle(Subscription $subscription, int $units): Subscription
    {
        return DB::transaction(function () use ($subscription, $units): Subscription {
            $subscription = Subscription::query()->with(['plan', 'account'])->lockForUpdate()->findOrFail($subscription->id);
            $included = $subscription->plan->included_units;

            if ($units < $included) {
                throw ValidationException::withMessages(['units' => "El plan incluye {$included} unidades; no puedes contratar menos."]);
            }

            if ($units > $subscription->billable_units) {
                $subscription->forceFill(['billable_units' => $units, 'pending_billable_units' => null, 'pending_units_from' => null])->save();
            } elseif ($units < $subscription->billable_units) {
                $inUse = $this->capacity->activeUnits($subscription->account);
                if ($units < $inUse) {
                    throw ValidationException::withMessages(['units' => "Tienes {$inUse} unidades activas; desactiva algunas antes de bajar a {$units}."]);
                }
                $subscription->forceFill(['pending_billable_units' => $units, 'pending_units_from' => $subscription->access_until->toImmutable()->startOfDay()])->save();
            } else {
                $subscription->forceFill(['pending_billable_units' => null, 'pending_units_from' => null])->save();
            }

            return $subscription;
        });
    }
}
