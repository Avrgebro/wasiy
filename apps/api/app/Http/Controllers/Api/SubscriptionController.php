<?php

namespace App\Http\Controllers\Api;

use App\Actions\Billing\ChangeContractedUnits;
use App\Enums\RegistryStatus;
use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Unit;
use App\Services\AccessContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Everything the subscription page shows (mockup 22, ADR 0040), for the
 * active Account. Lives outside the subscription gate on purpose: a lapsed
 * account's admin needs this page most, to see the invoice and pay it.
 */
class SubscriptionController extends Controller
{
    public function __construct(private readonly AccessContextService $context) {}

    public function show(Request $request): JsonResponse
    {
        $account = $this->context->activeAccountOrSingle($request, $request->user());
        abort_unless($account instanceof Account, 409, 'Selecciona una cuenta para ver su suscripción.');
        Gate::authorize('manageBilling', $account);

        $subscription = $account->subscription()->with('plan')->first();
        if (! $subscription instanceof Subscription) {
            return response()->json(['data' => null]);
        }

        $unitsInUse = Unit::query()->where('account_id', $account->id)->where('status', RegistryStatus::Active->value)->count();
        $plan = $subscription->plan;
        $base = $plan->included_units * $subscription->unit_price_minor;
        $extraUnits = max(0, $subscription->billable_units - $plan->included_units);
        $lastPaid = $subscription->invoices()->whereNotNull('paid_at')->latest('paid_at')->first();

        return response()->json(['data' => [
            'account' => ['id' => $account->id, 'name' => $account->name],
            'plan' => [
                'code' => $plan->code, 'name' => $plan->name, 'unit_price_minor' => $subscription->unit_price_minor,
                'currency' => $subscription->currency, 'included_units' => $plan->included_units, 'features' => $plan->features,
            ],
            'subscription' => [
                'status' => $subscription->status->value,
                'trial_ends_at' => $subscription->trial_ends_at->toIso8601String(),
                'access_until' => $subscription->access_until->toIso8601String(),
                'days_left' => $subscription->daysLeft(),
                'is_lapsed' => $subscription->isLapsed(),
                'billable_units' => $subscription->billable_units,
                'units_in_use' => $unitsInUse,
                'pending_billable_units' => $subscription->pending_billable_units,
                'pending_units_from' => $subscription->pending_units_from?->toDateString(),
                'last_paid_at' => $lastPaid?->paid_at?->toIso8601String(),
            ],
            'breakdown' => [
                'base_units' => $plan->included_units, 'base_minor' => $base,
                'extra_units' => $extraUnits, 'extra_minor' => $extraUnits * $subscription->unit_price_minor,
                'total_minor' => $base + $extraUnits * $subscription->unit_price_minor,
            ],
            'invoices' => $subscription->invoices()->with('latestProof')->latest('issued_at')->get()->map(fn (Invoice $invoice) => $this->invoice($invoice))->values(),
            'payment_instructions' => $this->paymentInstructions(),
            // Totals per plan for this account's contracted units (ADR 0040).
            'plans' => Plan::query()->where('is_available', true)->orderBy('unit_price_minor')->get()->map(fn (Plan $candidate) => [
                'code' => $candidate->code, 'name' => $candidate->name, 'unit_price_minor' => $candidate->unit_price_minor,
                'included_units' => $candidate->included_units, 'features' => $candidate->features,
                'total_minor' => max($subscription->billable_units, $candidate->included_units) * $candidate->unit_price_minor,
                'is_current' => $candidate->id === $plan->id,
            ])->values(),
            'contact_email' => (string) config('wasiy.leads.notify_email'),
        ]]);
    }

    /** "Ampliar unidades": up applies now, down waits for the renewal (ADR 0040). */
    public function updateUnits(Request $request, ChangeContractedUnits $change): JsonResponse
    {
        $account = $this->context->activeAccountOrSingle($request, $request->user());
        abort_unless($account instanceof Account, 409, 'Selecciona una cuenta para ver su suscripción.');
        Gate::authorize('manageBilling', $account);
        $subscription = $account->subscription;
        abort_unless($subscription instanceof Subscription, 404);

        $validated = $request->validate(['units' => ['required', 'integer', 'min:1', 'max:10000']]);
        $change->handle($subscription, (int) $validated['units']);

        return $this->show($request);
    }

    /** @return array<string, mixed> */
    private function invoice(Invoice $invoice): array
    {
        return [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'period_starts_on' => $invoice->period_starts_on->toDateString(),
            'period_ends_on' => $invoice->period_ends_on->toDateString(),
            'amount_minor' => $invoice->amount_minor,
            'currency' => $invoice->currency,
            'status' => $invoice->status->value,
            'due_on' => $invoice->due_on->toDateString(),
            'paid_at' => $invoice->paid_at?->toIso8601String(),
            'payment_method' => $invoice->payment_method?->value,
            'rejection_reason' => $invoice->rejection_reason,
            'latest_proof' => $invoice->latestProof ? InvoiceProofController::proof($invoice->latestProof) : null,
        ];
    }

    /** Null when nothing is configured, so the block can hide entirely. */
    private function paymentInstructions(): ?array
    {
        $transfer = config('wasiy.billing.transfer');
        $yape = config('wasiy.billing.yape');
        $plin = config('wasiy.billing.plin');

        $instructions = [
            'transfer' => $transfer['account_number'] ? $transfer : null,
            'yape' => $yape['number'] ? $yape : null,
            'plin' => $plin['number'] ? $plin : null,
        ];

        return array_filter($instructions) === [] ? null : $instructions;
    }
}
