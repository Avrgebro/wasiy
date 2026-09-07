<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Subscription;
use App\Notifications\BillingNoticeNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

/** Composes the billing emails at each invoice transition (ADR 0040). */
class BillingNotifier
{
    public function __construct(private readonly BillingRecipients $recipients) {}

    public function invoiceIssued(Invoice $invoice): void
    {
        $this->toAdmins($invoice, 'Nueva factura', "Emitimos la factura {$invoice->number} por el periodo que empieza el ".$this->day($invoice->period_starts_on).'. Puedes pagarla y subir el comprobante desde Suscripción.', 'Ver factura');
    }

    public function proofReceived(Invoice $invoice): void
    {
        Notification::route('mail', (string) config('wasiy.billing.review_email'))->notify(new BillingNoticeNotification(
            accountName: $invoice->account->name,
            title: 'Comprobante por revisar',
            intro: "{$invoice->account->name} subió un comprobante para la factura {$invoice->number}.",
            facts: $this->facts($invoice),
            footnote: "Confírmala con invoices:confirm {$invoice->number} o recházala con invoices:reject.",
        ));
        $this->toAdmins($invoice, 'Comprobante recibido', "Recibimos tu comprobante de la factura {$invoice->number}. Lo revisamos en un día hábil y te avisamos por aquí.");
    }

    public function paymentConfirmed(Invoice $invoice): void
    {
        $until = $invoice->subscription->access_until;
        $this->toAdmins($invoice, 'Pago confirmado', "Confirmamos el pago de la factura {$invoice->number}. Tu cuenta sigue activa hasta el ".$this->day($until).'.', 'Ver suscripción');
    }

    public function paymentRejected(Invoice $invoice): void
    {
        $this->toAdmins($invoice, 'Comprobante rechazado', "No pudimos confirmar el pago de la factura {$invoice->number}: {$invoice->rejection_reason} Puedes subir otro comprobante desde Suscripción.", 'Ver factura');
    }

    public function planChangeRequested(Subscription $subscription): void
    {
        $account = $subscription->account;
        $facts = [
            ['label' => 'Plan actual', 'value' => $subscription->plan->name],
            ['label' => 'Plan solicitado', 'value' => $subscription->requestedPlan->name],
            ['label' => 'Unidades contratadas', 'value' => (string) $subscription->billable_units],
            ['label' => 'Próxima renovación', 'value' => $this->day($subscription->access_until)],
        ];
        Notification::route('mail', (string) config('wasiy.billing.review_email'))->notify(new BillingNoticeNotification(
            accountName: $account->name,
            title: 'Solicitud de cambio de plan',
            intro: "{$account->name} pide pasar al plan {$subscription->requestedPlan->name} en la siguiente renovación.",
            facts: $facts,
        ));
        $emails = $this->recipients->adminEmails($account);
        if ($emails->isNotEmpty()) {
            Notification::route('mail', $emails->all())->notify(new BillingNoticeNotification(
                accountName: $account->name,
                title: 'Solicitud recibida',
                intro: "Recibimos tu solicitud para pasar al plan {$subscription->requestedPlan->name}. Se aplica en la siguiente renovación y te confirmamos por correo.",
                facts: $facts,
            ));
        }
    }

    private function toAdmins(Invoice $invoice, string $title, string $intro, ?string $actionLabel = null): void
    {
        $emails = $this->recipients->adminEmails($invoice->account);
        if ($emails->isEmpty()) {
            return;
        }

        $notification = new BillingNoticeNotification(
            accountName: $invoice->account->name,
            title: $title,
            intro: $intro,
            facts: $this->facts($invoice),
            actionLabel: $actionLabel,
            actionUrl: $actionLabel !== null ? rtrim((string) config('wasiy.invitations.spa_url'), '/').'/admin/subscription' : null,
        );
        Notification::route('mail', $emails->all())->notify($notification);
    }

    /** @return array<int, array{label: string, value: string}> */
    private function facts(Invoice $invoice): array
    {
        return [
            ['label' => 'Factura', 'value' => $invoice->number],
            ['label' => 'Periodo', 'value' => $this->day($invoice->period_starts_on).' – '.$this->day($invoice->period_ends_on)],
            ['label' => 'Monto', 'value' => 'S/ '.number_format($invoice->amount_minor / 100, 2)],
        ];
    }

    private function day(\DateTimeInterface $date): string
    {
        return CarbonImmutable::instance($date)->setTimezone('America/Lima')->locale('es')->isoFormat('D [de] MMMM');
    }
}
