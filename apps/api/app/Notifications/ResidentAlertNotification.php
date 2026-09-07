<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The alert email (mockup 03d): eyebrow with the location, a headline, a
 * short fact table and a single button into the portal. Every kind shares
 * the data shape so residents learn one layout; a kind may name its own
 * template when it earns a dedicated design.
 */
class ResidentAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<int, array{label: string, value: string}>  $facts
     */
    public function __construct(
        public readonly string $locationName,
        public readonly string $recipientName,
        public readonly string $title,
        public readonly ?string $intro,
        public readonly ?string $body,
        public readonly array $facts = [],
        public readonly ?string $footnote = null,
        public readonly ?string $actionLabel = null,
        public readonly ?string $actionUrl = null,
        public readonly ?string $alertId = null,
        /** File under packages/mailing/emails; the shared alert unless the kind has its own design. */
        public readonly string $template = 'resident-alert',
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /** Branded template compiled from packages/mailing/emails/{$template}.vue. */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->title} · {$this->locationName}")
            ->view("mail.maizzle.{$this->template}", [
                'locationName' => $this->locationName,
                'recipientName' => $this->recipientName,
                'title' => $this->title,
                'intro' => $this->intro ?? $this->body,
                'footnote' => $this->footnote,
                'facts' => $this->facts,
                'actionLabel' => $this->actionLabel,
                'actionUrl' => $this->actionUrl,
            ]);
    }
}
