<?php

namespace App\Console\Commands;

use App\Actions\Billing\ConfirmInvoicePayment;
use App\Models\Invoice;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

/** Closes an invoice by hand until the Filament review queue exists (ADR 0040). */
class ConfirmInvoice extends Command
{
    protected $signature = 'invoices:confirm {number : The invoice number, e.g. F-2026-0042} {--paid-at= : When the money arrived (YYYY-MM-DD); defaults to today}';

    protected $description = 'Mark an invoice as paid and extend the subscription to the end of its period';

    public function handle(ConfirmInvoicePayment $confirm): int
    {
        $invoice = Invoice::query()->where('number', $this->argument('number'))->first();
        if (! $invoice) {
            $this->error('No invoice with that number.');

            return self::FAILURE;
        }

        $paidAt = $this->option('paid-at') ? CarbonImmutable::parse((string) $this->option('paid-at')) : null;
        $invoice = $confirm->handle($invoice, $paidAt);
        $this->info("{$invoice->number} paid. Access until {$invoice->subscription->access_until->toDateString()}.");

        return self::SUCCESS;
    }
}
