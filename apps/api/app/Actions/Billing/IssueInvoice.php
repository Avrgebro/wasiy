<?php

namespace App\Actions\Billing;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\Subscription;
use App\Services\BillingNotifier;
use App\Support\InvoiceNumber;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * The next period's invoice for a subscription (ADR 0040). Covers the month
 * that starts when access_until ends, for the contracted units at the
 * locked unit price. Idempotent: a subscription with an open invoice gets
 * nothing new.
 */
class IssueInvoice
{
    /** How many days before access_until the invoice appears; also the due date. */
    public const LEAD_DAYS = 7;

    public function __construct(private readonly BillingNotifier $notifier) {}

    public function handle(Subscription $subscription, ?CarbonImmutable $now = null): ?Invoice
    {
        $now = $now ?? CarbonImmutable::now();

        return DB::transaction(function () use ($subscription, $now): ?Invoice {
            $subscription = Subscription::query()->lockForUpdate()->findOrFail($subscription->id);
            if ($subscription->openInvoice() !== null) {
                return null;
            }

            $start = $subscription->access_until->toImmutable()->startOfDay();
            $end = $start->addMonth()->subDay();
            $units = $subscription->pendingUnitsApplyOn($start) ?? $subscription->billable_units;

            $invoice = Invoice::create([
                'account_id' => $subscription->account_id,
                'subscription_id' => $subscription->id,
                'number' => InvoiceNumber::next($now->year),
                'period_starts_on' => $start,
                'period_ends_on' => $end,
                'billable_units' => $units,
                'unit_price_minor' => $subscription->unit_price_minor,
                'amount_minor' => $units * $subscription->unit_price_minor,
                'currency' => $subscription->currency,
                'status' => InvoiceStatus::Pending,
                'due_on' => $start,
                'issued_at' => $now,
            ]);
            $this->notifier->invoiceIssued($invoice);

            return $invoice;
        });
    }
}
