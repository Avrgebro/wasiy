<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The one alert email (mockup 03d): eyebrow with the location, a headline,
 * a short fact table and a single button into the portal. Every alert kind
 * renders through this template so residents learn one shape.
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
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->title} · {$this->locationName}")
            ->theme('wasiy')
            ->markdown('mail.resident-alert', [
                'locationName' => $this->locationName,
                'recipientName' => $this->recipientName,
                'title' => $this->title,
                'intro' => $this->intro ?? $this->body,
                'footnote' => $this->footnote,
                'facts' => $this->facts,
                'actionLabel' => $this->actionLabel,
                'actionUrl' => $this->actionUrl,
                'portalUrl' => config('wasiy.portal.url'),
            ]);
    }
}
