<?php

namespace App\Actions\Billing;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\InvoicePaymentProof;
use App\Models\User;
use App\Services\BillingNotifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The customer shows they paid (ADR 0040). Stores the file privately, records
 * the optional details that speed up the review, moves the invoice under
 * review and tells the team.
 */
class SubmitPaymentProof
{
    public function __construct(private readonly BillingNotifier $notifier) {}

    /** @param  array{paid_on?: string|null, amount_minor?: int|null, operation_number?: string|null}  $details */
    public function handle(Invoice $invoice, User $uploader, UploadedFile $file, array $details = []): InvoicePaymentProof
    {
        return DB::transaction(function () use ($invoice, $uploader, $file, $details): InvoicePaymentProof {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoice->id);
            if (! $invoice->status->acceptsProof()) {
                throw ValidationException::withMessages(['file' => 'Esta factura ya está en revisión o pagada.']);
            }

            // Default disk (FILESYSTEM_DISK), recorded on the row like photos.
            $disk = (string) config('filesystems.default');
            $path = $file->storeAs("payment-proofs/{$invoice->account_id}", Str::ulid()->toBase32().'.'.$file->extension(), ['disk' => $disk]);

            $proof = $invoice->proofs()->create([
                'uploaded_by' => $uploader->id,
                'disk' => $disk,
                'path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => (string) $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'paid_on' => $details['paid_on'] ?? null,
                'amount_minor' => $details['amount_minor'] ?? null,
                'operation_number' => $details['operation_number'] ?? null,
            ]);

            $invoice->forceFill(['status' => InvoiceStatus::UnderReview, 'rejection_reason' => null])->save();
            $this->notifier->proofReceived($invoice);

            return $proof;
        });
    }
}
