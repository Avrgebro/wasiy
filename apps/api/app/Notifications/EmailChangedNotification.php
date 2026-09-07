<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Heads-up to the previous address once the login email has changed. */
class EmailChangedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $firstName, public readonly string $previousEmail, public readonly string $newEmail) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /** Branded template compiled from packages/mailing/emails/email-changed.vue. */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Tu correo de acceso a Wasiy cambió')
            ->view('mail.maizzle.email-changed', [
                'firstName' => $this->firstName,
                'previousEmail' => $this->previousEmail,
                'newEmail' => $this->newEmail,
                'contactEmail' => (string) config('wasiy.leads.notify_email'),
            ]);
    }
}
