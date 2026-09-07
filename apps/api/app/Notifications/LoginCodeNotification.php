<?php

namespace App\Notifications;

use App\Support\PendingLoginCode;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** One-time code for the passwordless "Continúa con código" login. */
class LoginCodeNotification extends Notification implements ShouldQueue
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

    /** Branded template compiled from packages/mailing/emails/login-code.vue. */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Tu código de acceso a Wasiy')
            ->view('mail.maizzle.login-code', [
                'code' => $this->code,
                'minutes' => PendingLoginCode::CODE_LIFETIME_MINUTES,
            ]);
    }
}
