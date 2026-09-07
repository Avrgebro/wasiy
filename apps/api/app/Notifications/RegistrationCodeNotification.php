<?php

namespace App\Notifications;

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

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Tu código de verificación de Wasiy')
            ->greeting('Confirma tu correo')
            ->line('Ingresa este código en la página de registro:')
            ->line($this->code)
            ->line('Vence en 10 minutos. No compartas este código.')
            ->line('Si no solicitaste este registro, puedes ignorar este correo.');
    }
}
