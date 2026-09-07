<?php

namespace App\Notifications;

use App\Support\PendingRegistration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RegistrationCodeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $code)
    {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /** Branded template compiled from packages/mailing/emails/registration-code.vue. */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Tu código de verificación de Wasiy')
            ->view('mail.maizzle.registration-code', [
                'code' => $this->code,
                'minutes' => PendingRegistration::CODE_LIFETIME_MINUTES,
            ]);
    }
}
