<?php

namespace App\Notifications;

use App\Models\Package;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PackageReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Package $package,
        public readonly string $recipientName,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $package = $this->package->loadMissing(['unit', 'location']);
        $when = $package->received_at->setTimezone($package->location->timezone)->locale('es')->isoFormat('D [de] MMMM, HH:mm');

        $message = (new MailMessage)
            ->subject("Tienes un paquete en recepción · {$package->unit->label()}")
            ->greeting("Hola {$this->recipientName},")
            ->line("Recepción de {$package->location->name} recibió un paquete para la unidad {$package->unit->label()} el {$when}.");

        if ($package->notes) {
            $message->line("Detalle: {$package->notes}");
        }

        return $message->line('Puedes retirarlo en recepción presentando tu documento.');
    }
}
