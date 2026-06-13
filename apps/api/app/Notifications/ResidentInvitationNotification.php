<?php

namespace App\Notifications;

use App\Models\UserInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResidentInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly UserInvitation $invitation,
        public readonly string $token,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Activa tu acceso al portal de residentes')
            ->greeting("Hola {$this->invitation->first_name},")
            ->line("Has sido invitado al portal de residentes de {$this->invitation->account->name}.")
            ->action('Activar acceso', $this->claimUrl())
            ->line('Este enlace vence el '.$this->invitation->expires_at->format('Y-m-d').'.');
    }

    private function claimUrl(): string
    {
        $template = (string) config('wasiy.invitations.resident_claim_url');

        return str_replace('{token}', $this->token, $template);
    }
}
