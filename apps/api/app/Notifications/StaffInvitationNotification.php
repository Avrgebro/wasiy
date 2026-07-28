<?php

namespace App\Notifications;

use App\Models\UserInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffInvitationNotification extends Notification implements ShouldQueue
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
            ->subject('Te invitaron al equipo de '.$this->invitation->account->name)
            ->greeting("Hola {$this->invitation->first_name},")
            ->line("Te invitaron a formar parte del equipo de {$this->invitation->account->name} en Wasiy.")
            ->action('Aceptar invitación', $this->claimUrl())
            ->line('Este enlace vence el '.$this->invitation->expires_at->format('Y-m-d').'.');
    }

    private function claimUrl(): string
    {
        $template = (string) config('wasiy.invitations.staff_claim_url');

        return str_replace('{token}', $this->token, $template);
    }
}
