<?php

namespace Database\Seeders;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Enums\SubscriptionStatus;
use App\Models\Account;
use App\Models\Invoice;
use App\Models\InvoicePaymentProof;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\InvoiceNumber;
use Carbon\CarbonImmutable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * The subscription model behind the demo accounts (ADR 0039, ADR 0040).
 * wasiy-demo is a paying customer five months in: Operativo, three paid
 * invoices, and the next period's invoice under review with a proof
 * attached, so the subscription page shows a full history and the review
 * queue has a row. wasiy-playa is a trial in its last week, so the banner
 * shows and the lock is a few days away. Rows are written directly, not
 * through the billing actions, so seeding sends no emails. Idempotent by
 * account and period.
 */
class DemoSubscriptionsSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $now = CarbonImmutable::now('America/Lima');
        $operativo = Plan::query()->where('code', 'operativo')->firstOrFail();
        $esencial = Plan::query()->where('code', 'esencial')->firstOrFail();
        $admin = User::query()->where('email', 'admin@wasiy.test')->firstOrFail();

        // Paying customer: four monthly periods, the current one ends in 5 days.
        $demo = Account::query()->where('slug', 'wasiy-demo')->firstOrFail();
        $trialStart = $now->subMonths(4)->subDays(19)->startOfDay();
        $trialEnd = $trialStart->addDays(14);
        $currentPeriodEnd = $now->addDays(5)->endOfDay();

        $subscription = $this->subscription($demo, [
            'plan_id' => $operativo->id,
            'status' => SubscriptionStatus::Active,
            'unit_price_minor' => $operativo->unit_price_minor,
            'billable_units' => 48,
            'currency' => 'PEN',
            'trial_starts_at' => $trialStart,
            'trial_ends_at' => $trialEnd,
            'access_until' => $currentPeriodEnd,
            'terms_accepted_at' => $trialStart,
        ]);

        // Three paid periods back to back, the first starting when the trial ended.
        $start = $trialEnd->startOfDay();
        foreach ([[PaymentMethod::Transfer, 2], [PaymentMethod::Transfer, 6], [PaymentMethod::Transfer, 1]] as $index => [$method, $paidAfterDays]) {
            $end = $index === 2 ? $currentPeriodEnd->startOfDay() : $start->addMonth()->subDay();
            $this->invoice($subscription, $start, $end, [
                'status' => InvoiceStatus::Paid,
                'issued_at' => $start->subDays(7)->setTime(8, 0),
                'paid_at' => $start->subDays(7)->addDays($paidAfterDays)->setTime(11, 30),
                'payment_method' => $method,
            ]);
            $start = $end->addDay();
        }

        // Next period: issued 7 days before access_until, proof uploaded yesterday, waiting on the team.
        $nextStart = $currentPeriodEnd->startOfDay()->addDay();
        $underReview = $this->invoice($subscription, $nextStart, $nextStart->addMonth()->subDay(), [
            'status' => InvoiceStatus::UnderReview,
            'issued_at' => $now->subDays(2)->setTime(8, 0),
        ]);
        $this->proof($underReview, $admin, $now->subDay());

        // Trial in its last week: banner on, lock four days away, no invoices yet.
        $playa = Account::query()->where('slug', 'wasiy-playa')->firstOrFail();
        $playaTrialStart = $now->subDays(10)->startOfDay();
        $this->subscription($playa, [
            'plan_id' => $esencial->id,
            'status' => SubscriptionStatus::Trialing,
            'unit_price_minor' => $esencial->unit_price_minor,
            'billable_units' => $esencial->included_units,
            'currency' => 'PEN',
            'trial_starts_at' => $playaTrialStart,
            'trial_ends_at' => $playaTrialStart->addDays(14),
            'access_until' => $playaTrialStart->addDays(14),
            'terms_accepted_at' => $playaTrialStart,
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function subscription(Account $account, array $attributes): Subscription
    {
        return Subscription::query()->updateOrCreate(['account_id' => $account->id], $attributes);
    }

    /**
     * Keyed by period so re-seeding updates rather than duplicates; the
     * gapless number is drawn only when the row is new.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function invoice(Subscription $subscription, CarbonImmutable $start, CarbonImmutable $end, array $attributes): Invoice
    {
        $invoice = Invoice::query()->firstOrNew([
            'subscription_id' => $subscription->id,
            'period_starts_on' => $start->toDateString(),
        ]);

        $invoice->fill([
            'account_id' => $subscription->account_id,
            'number' => $invoice->number ?? InvoiceNumber::next($start->year),
            'period_ends_on' => $end,
            'billable_units' => $subscription->billable_units,
            'unit_price_minor' => $subscription->unit_price_minor,
            'amount_minor' => $subscription->billable_units * $subscription->unit_price_minor,
            'currency' => $subscription->currency,
            'due_on' => $start,
            'paid_at' => null,
            'payment_method' => null,
            'rejection_reason' => null,
            ...$attributes,
        ])->save();

        return $invoice;
    }

    /** A one-page placeholder PDF on the default disk, so the review screen has something to open. */
    private function proof(Invoice $invoice, User $uploadedBy, CarbonImmutable $paidOn): void
    {
        $disk = (string) config('filesystems.default');
        $path = "payment-proofs/{$invoice->account_id}/demo-{$invoice->number}.pdf";

        if (! Storage::disk($disk)->exists($path)) {
            Storage::disk($disk)->put($path, $this->placeholderPdf("Constancia de transferencia · {$invoice->number}"));
        }

        InvoicePaymentProof::query()->updateOrCreate(
            ['invoice_id' => $invoice->id, 'path' => $path],
            [
                'uploaded_by' => $uploadedBy->id,
                'disk' => $disk,
                'original_filename' => 'constancia-bcp.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => Storage::disk($disk)->size($path),
                'paid_on' => $paidOn->toDateString(),
                'amount_minor' => $invoice->amount_minor,
                'operation_number' => '00482913',
            ],
        );
    }

    private function placeholderPdf(string $text): string
    {
        $stream = "BT /F1 14 Tf 40 750 Td ({$text}) Tj ET";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n{$object}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= 'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";

        return $pdf;
    }
}
