<?php

namespace App\Actions\Billing;

use App\Models\Plan;
use App\Models\Subscription;
use App\Services\BillingNotifier;
use Illuminate\Validation\ValidationException;

/**
 * "Solicitar cambio" (ADR 0040). Plan changes are manual for now and apply
 * at the next renewal, so the request is recorded on the subscription and
 * the team is told; passing null withdraws it.
 */
class RequestPlanChange
{
    public function __construct(private readonly BillingNotifier $notifier) {}

    public function handle(Subscription $subscription, ?Plan $plan): Subscription
    {
        if ($plan === null) {
            $subscription->forceFill(['requested_plan_id' => null, 'plan_change_requested_at' => null])->save();

            return $subscription;
        }

        if (! $plan->is_available) {
            throw ValidationException::withMessages(['plan' => 'Ese plan no está disponible.']);
        }
        if ($plan->id === $subscription->plan_id) {
            throw ValidationException::withMessages(['plan' => 'Ese ya es tu plan actual.']);
        }

        $subscription->forceFill(['requested_plan_id' => $plan->id, 'plan_change_requested_at' => now()])->save();
        $this->notifier->planChangeRequested($subscription->refresh());

        return $subscription;
    }
}
