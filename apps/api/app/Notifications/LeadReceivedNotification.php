<?php

namespace App\Notifications;

use App\Models\Lead;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Heads-up to the sales inbox; the lead itself is already stored. */
class LeadReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Lead $lead)
    {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $lead = $this->lead;
        $kind = $lead->source === 'demo' ? 'Solicitud de demo' : 'Mensaje de contacto';
        $mail = (new MailMessage)
            ->subject("{$kind}: {$lead->name}")
            ->greeting($kind)
            ->replyTo($lead->email, $lead->name)
            ->line("**Nombre:** {$lead->name}")
            ->line("**Correo:** {$lead->email}");
        foreach ([
            'Teléfono' => $lead->phone,
            'Organización' => $lead->organization,
            'Perfil' => $lead->profile,
            'Unidades' => $lead->units ?? $lead->units_range,
            'Le urge' => $lead->interests ? implode(', ', $lead->interests) : null,
            'Franja' => $lead->preferred_slot,
        ] as $label => $value) {
            if (filled($value)) {
                $mail->line("**{$label}:** {$value}");
            }
        }
        if (filled($lead->message)) {
            $mail->line('**Mensaje:**')->line($lead->message);
        }

        return $mail->line("Recibido el {$lead->created_at->timezone('America/Lima')->format('d/m/Y H:i')} desde {$lead->ip}.");
    }
}
