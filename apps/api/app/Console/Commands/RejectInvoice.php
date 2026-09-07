<?php

namespace App\Console\Commands;

use App\Actions\Billing\RejectInvoicePayment;
use App\Models\Invoice;
use Illuminate\Console\Command;

class RejectInvoice extends Command
{
    protected $signature = 'invoices:reject {number : The invoice number} {reason : Shown to the customer under the invoice}';

    protected $description = 'Reject the payment proof of an invoice with a reason the customer will see';

    public function handle(RejectInvoicePayment $reject): int
    {
        $invoice = Invoice::query()->where('number', $this->argument('number'))->first();
        if (! $invoice) {
            $this->error('No invoice with that number.');

            return self::FAILURE;
        }

        $reject->handle($invoice, (string) $this->argument('reason'));
        $this->info("{$invoice->number} rejected.");

        return self::SUCCESS;
    }
}
