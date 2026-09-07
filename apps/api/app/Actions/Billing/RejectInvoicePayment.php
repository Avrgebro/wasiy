<?php

namespace App\Actions\Billing;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use InvalidArgumentException;

/** The proof did not match the statement; the customer sees why and can upload again. */
class RejectInvoicePayment
{
    public function handle(Invoice $invoice, string $reason): Invoice
    {
        if ($invoice->status === InvoiceStatus::Paid) {
            throw new InvalidArgumentException("La factura {$invoice->number} ya está pagada.");
        }

        $invoice->forceFill(['status' => InvoiceStatus::Rejected, 'rejection_reason' => trim($reason)])->save();

        return $invoice;
    }
}
