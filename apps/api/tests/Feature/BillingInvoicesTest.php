<?php

use App\Actions\Billing\ConfirmInvoicePayment;
use App\Actions\Billing\IssueInvoice;
use App\Actions\Billing\RejectInvoicePayment;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Enums\SubscriptionStatus;
use App\Models\Invoice;
use App\Models\Subscription;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->travelTo('2026-09-14 09:00:00');
});

function trialEndingSoon(array $overrides = []): Subscription
{
    return Subscription::factory()->create([
        'status' => SubscriptionStatus::Trialing,
        'billable_units' => 40,
        'unit_price_minor' => 650,
        'trial_ends_at' => CarbonImmutable::parse('2026-09-21 12:00:00'),
        'access_until' => CarbonImmutable::parse('2026-09-21 12:00:00'),
        ...$overrides,
    ]);
}

it('issues the next period for the contracted units at the locked price, once', function () {
    $subscription = trialEndingSoon();

    $invoice = app(IssueInvoice::class)->handle($subscription);

    expect($invoice)->not->toBeNull()
        ->and($invoice->number)->toBe('F-2026-0001')
        ->and($invoice->period_starts_on->toDateString())->toBe('2026-09-21')
        ->and($invoice->period_ends_on->toDateString())->toBe('2026-10-20')
        ->and($invoice->due_on->toDateString())->toBe('2026-09-21')
        ->and($invoice->billable_units)->toBe(40)
        ->and($invoice->unit_price_minor)->toBe(650)
        ->and($invoice->amount_minor)->toBe(26000)
        ->and($invoice->status)->toBe(InvoiceStatus::Pending)
        ->and($invoice->account_id)->toBe($subscription->account_id);

    // A second run finds the open invoice and issues nothing.
    expect(app(IssueInvoice::class)->handle($subscription))->toBeNull()
        ->and(Invoice::query()->count())->toBe(1);
});

it('numbers invoices globally and without gaps within the year', function () {
    $first = app(IssueInvoice::class)->handle(trialEndingSoon());
    $second = app(IssueInvoice::class)->handle(trialEndingSoon());

    expect($first->number)->toBe('F-2026-0001')->and($second->number)->toBe('F-2026-0002');
});

it('the daily command only issues for subscriptions ending within the lead time', function () {
    $soon = trialEndingSoon();
    $later = trialEndingSoon(['access_until' => CarbonImmutable::parse('2026-09-30 12:00:00')]);
    $expired = trialEndingSoon(['status' => SubscriptionStatus::Expired, 'access_until' => CarbonImmutable::parse('2026-09-01 12:00:00')]);

    $this->artisan('invoices:issue')->expectsOutput('Issued 1 invoice(s).')->assertSuccessful();

    expect(Invoice::query()->where('subscription_id', $soon->id)->exists())->toBeTrue()
        ->and(Invoice::query()->where('subscription_id', $later->id)->exists())->toBeFalse()
        ->and(Invoice::query()->where('subscription_id', $expired->id)->exists())->toBeFalse();
});

it('confirming a payment activates the subscription to the period end and applies a scheduled decrease', function () {
    $subscription = trialEndingSoon(['pending_billable_units' => 30, 'pending_units_from' => CarbonImmutable::parse('2026-09-21')]);
    $invoice = app(IssueInvoice::class)->handle($subscription);
    expect($invoice->billable_units)->toBe(30)->and($invoice->amount_minor)->toBe(19500);

    $this->artisan('invoices:confirm', ['number' => $invoice->number, '--paid-at' => '2026-09-18'])->assertSuccessful();

    $invoice->refresh();
    $subscription->refresh();
    expect($invoice->status)->toBe(InvoiceStatus::Paid)
        ->and($invoice->paid_at->toDateString())->toBe('2026-09-18')
        ->and($invoice->payment_method)->toBe(PaymentMethod::Transfer)
        ->and($subscription->status)->toBe(SubscriptionStatus::Active)
        ->and($subscription->access_until->toDateString())->toBe('2026-10-20')
        ->and($subscription->billable_units)->toBe(30)
        ->and($subscription->pending_billable_units)->toBeNull()
        ->and($subscription->isLapsed())->toBeFalse();

    expect(fn () => app(ConfirmInvoicePayment::class)->handle($invoice))->toThrow(InvalidArgumentException::class);
});

it('a decrease scheduled after the period start waits for the following invoice', function () {
    $subscription = trialEndingSoon(['pending_billable_units' => 30, 'pending_units_from' => CarbonImmutable::parse('2026-10-21')]);

    $invoice = app(IssueInvoice::class)->handle($subscription);

    expect($invoice->billable_units)->toBe(40);
    app(ConfirmInvoicePayment::class)->handle($invoice);
    expect($subscription->fresh()->pending_billable_units)->toBe(30);
});

it('rejecting keeps the invoice open with the reason and never touches a paid one', function () {
    $invoice = app(IssueInvoice::class)->handle(trialEndingSoon());

    $this->artisan('invoices:reject', ['number' => $invoice->number, 'reason' => 'El monto no coincide con la factura.'])->assertSuccessful();
    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Rejected)
        ->and($invoice->fresh()->rejection_reason)->toBe('El monto no coincide con la factura.')
        ->and($invoice->fresh()->status->acceptsProof())->toBeTrue();

    app(ConfirmInvoicePayment::class)->handle($invoice);
    expect(fn () => app(RejectInvoicePayment::class)->handle($invoice->fresh(), 'tarde'))->toThrow(InvalidArgumentException::class)
        ->and($invoice->fresh()->rejection_reason)->toBeNull();
});

it('an active subscription gets its renewal invoice a week before access ends', function () {
    $subscription = trialEndingSoon(['status' => SubscriptionStatus::Active, 'access_until' => CarbonImmutable::parse('2026-10-20 23:59:59')]);
    $this->travelTo('2026-10-14 09:00:00');

    $this->artisan('invoices:issue')->assertSuccessful();

    $invoice = Invoice::query()->where('subscription_id', $subscription->id)->sole();
    expect($invoice->period_starts_on->toDateString())->toBe('2026-10-20')
        ->and($invoice->period_ends_on->toDateString())->toBe('2026-11-19')
        ->and($invoice->number)->toBe('F-2026-0001');
});
