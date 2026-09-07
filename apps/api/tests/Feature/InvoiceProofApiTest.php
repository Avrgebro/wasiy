<?php

use App\Actions\Billing\ConfirmInvoicePayment;
use App\Actions\Billing\IssueInvoice;
use App\Actions\Billing\RejectInvoicePayment;
use App\Enums\AccountRole;
use App\Enums\InvoiceStatus;
use App\Enums\LocationRole;
use App\Enums\SubscriptionStatus;
use App\Models\Account;
use App\Models\Location;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\BillingNoticeNotification;
use Carbon\CarbonImmutable;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->travelTo('2026-09-14 09:00:00');
    $this->seed(PlanSeeder::class);
    Storage::fake('local');
    Notification::fake();
    config()->set('wasiy.billing.review_email', 'cobros@wasiy.test');
});

function proofWorld(): array
{
    $account = Account::factory()->create(['name' => 'Administradora Horizonte']);
    Location::factory()->for($account)->create();
    $admin = User::factory()->create(['email' => 'ana@horizonte.pe']);
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);
    $subscription = Subscription::factory()->for($account)->for(Plan::query()->where('code', 'operativo')->sole())->create([
        'status' => SubscriptionStatus::Trialing, 'billable_units' => 40, 'unit_price_minor' => 650,
        'trial_ends_at' => CarbonImmutable::parse('2026-09-21 12:00:00'), 'access_until' => CarbonImmutable::parse('2026-09-21 12:00:00'),
    ]);
    $invoice = app(IssueInvoice::class)->handle($subscription);

    return [$account, $admin, $invoice];
}

function sentTo(string $email, string $title): bool
{
    $found = false;
    Notification::assertSentOnDemand(BillingNoticeNotification::class, function (BillingNoticeNotification $n, array $channels, AnonymousNotifiable $notifiable) use (&$found, $email, $title) {
        $routes = (array) $notifiable->routes['mail'];
        if ($n->title === $title && in_array($email, $routes, true)) {
            $found = true;
        }

        return true;
    });

    return $found;
}

it('issuing an invoice emails the account admins', function () {
    proofWorld();

    expect(sentTo('ana@horizonte.pe', 'Nueva factura'))->toBeTrue();
});

it('uploads a proof, moves the invoice under review and tells the team and the admin', function () {
    [$account, $admin, $invoice] = proofWorld();

    $response = $this->actingAs($admin)
        ->post("/api/account/invoices/{$invoice->id}/proofs", [
            'file' => UploadedFile::fake()->create('comprobante-bcp.pdf', 248, 'application/pdf'),
            'paid_on' => '2026-09-13', 'amount_minor' => 26000, 'operation_number' => '00483921',
        ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.original_filename', 'comprobante-bcp.pdf')
        ->assertJsonPath('data.paid_on', '2026-09-13')
        ->assertJsonPath('data.amount_minor', 26000)
        ->assertJsonPath('data.operation_number', '00483921');

    $invoice->refresh();
    expect($invoice->status)->toBe(InvoiceStatus::UnderReview)->and($invoice->proofs()->count())->toBe(1);
    Storage::disk('local')->assertExists($invoice->latestProof->path);
    expect(sentTo('cobros@wasiy.test', 'Comprobante por revisar'))->toBeTrue()
        ->and(sentTo('ana@horizonte.pe', 'Comprobante recibido'))->toBeTrue();

    // The page payload carries the latest proof, and the file streams back to the admin only.
    $this->actingAs($admin)->getJson('/api/account/subscription')
        ->assertJsonPath('data.invoices.0.status', 'under_review')
        ->assertJsonPath('data.invoices.0.latest_proof.id', $response->json('data.id'));
    $this->actingAs($admin)->get("/api/account/invoices/{$invoice->id}/proofs/{$response->json('data.id')}")->assertOk();

    $desk = User::factory()->create();
    grantLocationRole($account, Location::query()->where('account_id', $account->id)->sole(), $desk, LocationRole::FrontDesk);
    $this->actingAs($desk)->get("/api/account/invoices/{$invoice->id}/proofs/{$response->json('data.id')}", ['Accept' => 'application/json'])->assertForbidden();
});

it('only takes images or PDFs under the size limit, and only on invoices that accept a proof', function () {
    [$account, $admin, $invoice] = proofWorld();
    $url = "/api/account/invoices/{$invoice->id}/proofs";

    $this->actingAs($admin)->post($url, ['file' => UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['file']);
    $this->actingAs($admin)->post($url, ['file' => UploadedFile::fake()->create('big.pdf', 10241, 'application/pdf')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['file']);

    $this->actingAs($admin)->post($url, ['file' => UploadedFile::fake()->image('yape.png')], ['Accept' => 'application/json'])->assertCreated();
    // Under review now: a second upload waits for the team's answer.
    $this->actingAs($admin)->post($url, ['file' => UploadedFile::fake()->image('again.png')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['file']);

    app(RejectInvoicePayment::class)->handle($invoice->fresh(), 'El monto no coincide con la factura.');
    expect(sentTo('ana@horizonte.pe', 'Comprobante rechazado'))->toBeTrue();
    $this->actingAs($admin)->post($url, ['file' => UploadedFile::fake()->image('fixed.png')], ['Accept' => 'application/json'])->assertCreated();
    expect($invoice->fresh()->rejection_reason)->toBeNull()->and($invoice->fresh()->proofs()->count())->toBe(2);
});

it('confirming a payment emails the admins with the new access date', function () {
    [$account, $admin, $invoice] = proofWorld();

    app(ConfirmInvoicePayment::class)->handle($invoice);

    expect(sentTo('ana@horizonte.pe', 'Pago confirmado'))->toBeTrue();
});

it('another account cannot see or upload to the invoice', function () {
    [, , $invoice] = proofWorld();
    $other = Account::factory()->create();
    $intruder = User::factory()->create();
    createStaffMembership($other, $intruder, AccountRole::AccountAdmin);

    $this->actingAs($intruder)->post("/api/account/invoices/{$invoice->id}/proofs", ['file' => UploadedFile::fake()->image('x.png')], ['Accept' => 'application/json'])->assertNotFound();
});

it('renders the billing notice email', function () {
    $mail = (new BillingNoticeNotification('Administradora Horizonte', 'Nueva factura', 'Emitimos la factura F-2026-0042.', [['label' => 'Factura', 'value' => 'F-2026-0042']], null, 'Ver factura', 'http://localhost:5174/admin/subscription'))->toMail(new AnonymousNotifiable);

    expect($mail->subject)->toBe('Nueva factura · Administradora Horizonte')->and($mail->view)->toBe('mail.maizzle.billing-notice');
    expect((string) $mail->render())->toContain('Administradora Horizonte')->toContain('F-2026-0042')->toContain('Ver factura')->not->toContain('{{');
});
