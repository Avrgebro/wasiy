<?php

namespace App\Actions\Billing;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Enums\SubscriptionStatus;
use App\Models\Invoice;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The team saw the money. Marks the invoice paid and, because paying is
 * what buys time, moves access_until to the end of the period covered and
 * applies any scheduled unit decrease (ADR 0040).
 */
class ConfirmInvoicePayment
{
    public function handle(Invoice $invoice, ?CarbonImmutable $paidAt = null, PaymentMethod $method = PaymentMethod::Transfer): Invoice
    {
        return DB::transaction(function () use ($invoice, $paidAt, $method): Invoice {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoice->id);
            if ($invoice->status === InvoiceStatus::Paid) {
                throw new InvalidArgumentException("La factura {$invoice->number} ya está pagada.");
            }

            $invoice->forceFill([
                'status' => InvoiceStatus::Paid,
                'paid_at' => $paidAt ?? CarbonImmutable::now(),
                'payment_method' => $method,
                'rejection_reason' => null,
            ])->save();

            $subscription = $invoice->subscription;
            // A decrease scheduled for a later period stays scheduled.
            $decreaseApplied = $subscription->pendingUnitsApplyOn($invoice->period_starts_on) !== null;
            $subscription->forceFill([
                'status' => SubscriptionStatus::Active,
                'access_until' => $invoice->period_ends_on->endOfDay(),
                'billable_units' => $invoice->billable_units,
                'pending_billable_units' => $decreaseApplied ? null : $subscription->pending_billable_units,
                'pending_units_from' => $decreaseApplied ? null : $subscription->pending_units_from,
            ])->save();

            return $invoice;
        });
    }
}
