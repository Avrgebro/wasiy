<?php

namespace App\Actions\Registration;

use App\Notifications\RegistrationCodeNotification;
use App\Support\PendingRegistration;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;

class SendRegistrationCode
{
    /** Issues a fresh code on the pending registration; the caller persists it. */
    public function handle(PendingRegistration $pending): void
    {
        abort_if($pending->inResendCooldown(), 429, 'Espera 30 segundos antes de solicitar otro código.');
        $key = 'registration-email:'.hash('sha256', $pending->email);
        abort_if(RateLimiter::increment($key, 3600) > 5, 429, 'Has solicitado varios códigos. Inténtalo más tarde.');

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $pending->codeHash = Hash::make($code);
        $pending->codeSentAt = now()->toImmutable();
        $pending->codeExpiresAt = now()->addMinutes(PendingRegistration::CODE_LIFETIME_MINUTES)->toImmutable();
        $pending->attempts = 0;

        Notification::route('mail', $pending->email)->notify(new RegistrationCodeNotification($code));
    }
}
