<?php

namespace App\Http\Controllers\Api;

use App\Actions\Billing\SubmitPaymentProof;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePaymentProofRequest;
use App\Models\Account;
use App\Models\Invoice;
use App\Models\InvoicePaymentProof;
use App\Services\AccessContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Payment proofs on the active account's invoices (mockup 22c, ADR 0040). Outside the subscription gate like the page. */
class InvoiceProofController extends Controller
{
    public function __construct(private readonly AccessContextService $context) {}

    public function store(StorePaymentProofRequest $request, Invoice $invoice, SubmitPaymentProof $submit): JsonResponse
    {
        $this->authorizeInvoice($request, $invoice);

        $proof = $submit->handle($invoice, $request->user(), $request->file('file'), [
            'paid_on' => $request->validated('paid_on'),
            'amount_minor' => $request->validated('amount_minor'),
            'operation_number' => $request->validated('operation_number'),
        ]);

        return response()->json(['data' => $this->proof($proof)], 201);
    }

    public function show(Request $request, Invoice $invoice, InvoicePaymentProof $proof): StreamedResponse
    {
        $this->authorizeInvoice($request, $invoice);
        abort_unless($proof->invoice_id === $invoice->id, 404);
        abort_unless(Storage::disk($proof->disk)->exists($proof->path), 404);

        return Storage::disk($proof->disk)->response($proof->path, $proof->original_filename, ['Cache-Control' => 'private, no-store']);
    }

    private function authorizeInvoice(Request $request, Invoice $invoice): void
    {
        $account = $this->context->activeAccountOrSingle($request, $request->user());
        abort_unless($account instanceof Account && $invoice->account_id === $account->id, 404);
        Gate::authorize('manageBilling', $account);
    }

    /** @return array<string, mixed> */
    public static function proof(InvoicePaymentProof $proof): array
    {
        return [
            'id' => $proof->id,
            'original_filename' => $proof->original_filename,
            'mime_type' => $proof->mime_type,
            'size_bytes' => $proof->size_bytes,
            'paid_on' => $proof->paid_on?->toDateString(),
            'amount_minor' => $proof->amount_minor,
            'operation_number' => $proof->operation_number,
            'uploaded_at' => $proof->created_at?->toIso8601String(),
        ];
    }
}
