<?php

namespace App\Notifications;

use App\Support\PendingEmailChange;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Code sent to the new address when a user changes their login email. */
class EmailChangeCodeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $firstName, public readonly string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /** Branded template compiled from packages/mailing/emails/email-change-code.vue. */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirma tu nuevo correo de Wasiy')
            ->view('mail.maizzle.email-change-code', [
                'firstName' => $this->firstName,
                'code' => $this->code,
                'minutes' => PendingEmailChange::CODE_LIFETIME_MINUTES,
            ]);
    }
}
