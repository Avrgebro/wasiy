<?php

use App\Notifications\ResidentAlertNotification;
use Illuminate\Notifications\AnonymousNotifiable;

function packageReceivedNotification(string $template = 'package-received'): ResidentAlertNotification
{
    return new ResidentAlertNotification(
        locationName: 'Torre Norte',
        recipientName: 'Laura',
        title: 'Paquete recibido',
        intro: 'Recepción recibió un paquete y lo guarda hasta que lo retires con tu documento.',
        body: null,
        facts: [
            ['label' => 'Unidad', 'value' => 'Torre A / 402'],
            ['label' => 'Recibido', 'value' => '7 de setiembre, 10:15'],
            ['label' => 'Detalle', 'value' => 'Caja mediana de Mercado Libre'],
        ],
        footnote: 'Recibes este correo porque activaste las alertas de paquetes. Cámbialo en Perfil.',
        actionLabel: 'Ver paquetes',
        actionUrl: 'https://portal.wasiy.test/portal',
        template: $template,
    );
}

test('the package received email renders the branded Maizzle template with the parcel facts', function () {
    $mail = packageReceivedNotification()->toMail(new AnonymousNotifiable);

    expect($mail->subject)->toBe('Paquete recibido · Torre Norte')
        ->and($mail->view)->toBe('mail.maizzle.package-received');

    $html = (string) $mail->render();

    expect($html)->toContain('Hola Laura,')
        ->toContain('Torre Norte')
        ->toContain('Paquete recibido')
        ->toContain('Torre A / 402')
        ->toContain('7 de setiembre, 10:15')
        ->toContain('Caja mediana de Mercado Libre')
        ->toContain('documento de identidad')
        ->toContain('href="https://portal.wasiy.test/portal"')
        ->toContain('Ver paquetes')
        ->toContain('alertas de paquetes')
        ->toContain('images/mail/mark-cream.png')
        ->toContain('href="'.config('wasiy.marketing.url').'"')
        ->not->toContain('{{');
});

test('alert kinds without their own design render the shared alert template', function () {
    $mail = (new ResidentAlertNotification(
        locationName: 'Torre Norte',
        recipientName: 'Carlos',
        title: 'Reserva aprobada',
        intro: 'Tu reserva quedó confirmada.',
        body: null,
        facts: [['label' => 'Amenidad', 'value' => 'Parrilla']],
        actionLabel: 'Ver reserva',
        actionUrl: 'https://portal.wasiy.test/portal/reservas',
    ))->toMail(new AnonymousNotifiable);

    expect($mail->view)->toBe('mail.maizzle.resident-alert');

    $html = (string) $mail->render();

    expect($html)->toContain('Hola Carlos,')
        ->toContain('Torre Norte')
        ->toContain('Reserva aprobada')
        ->toContain('Parrilla')
        ->toContain('Ver reserva')
        ->not->toContain('{{');
});
