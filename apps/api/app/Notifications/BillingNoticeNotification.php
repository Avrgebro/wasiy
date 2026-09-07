<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The one billing email (ADR 0040): a headline, a short intro, the invoice
 * facts and a button into the subscription page. Issued, proof received,
 * confirmed and rejected all wear this shape so admins learn one layout.
 *
 * @param  array<int, array{label: string, value: string}>  $facts
 */
class BillingNoticeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $accountName,
        public readonly string $title,
        public readonly string $intro,
        public readonly array $facts = [],
        public readonly ?string $footnote = null,
        public readonly ?string $actionLabel = null,
        public readonly ?string $actionUrl = null,
    ) {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /** Branded template compiled from packages/mailing/emails/billing-notice.vue. */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->title} · {$this->accountName}")
            ->view('mail.maizzle.billing-notice', [
                'accountName' => $this->accountName,
                'title' => $this->title,
                'intro' => $this->intro,
                'facts' => $this->facts,
                'footnote' => $this->footnote,
                'actionLabel' => $this->actionLabel,
                'actionUrl' => $this->actionUrl,
            ]);
    }
}
