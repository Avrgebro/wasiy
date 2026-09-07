<?php

use App\Notifications\RegistrationCodeNotification;
use App\Support\PendingRegistration;
use Illuminate\Notifications\AnonymousNotifiable;

test('the registration code email renders the branded template with the code and lifetime', function () {
    $mail = (new RegistrationCodeNotification('482913'))->toMail(new AnonymousNotifiable);

    expect($mail->subject)->toBe('Tu código de verificación de Wasiy')
        ->and($mail->view)->toBe('mail.maizzle.registration-code');

    $html = (string) $mail->render();

    expect($html)->toContain('482913')
        ->toContain('Confirma tu correo')
        ->toContain(PendingRegistration::CODE_LIFETIME_MINUTES.' minutos')
        ->toContain('images/mail/mark-cream.png')
        ->toContain('href="'.config('wasiy.marketing.url').'"')
        ->not->toContain('{{');
});
