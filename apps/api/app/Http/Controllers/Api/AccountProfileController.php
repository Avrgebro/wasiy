<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\EmailChangeCodeNotification;
use App\Notifications\EmailChangedNotification;
use App\Support\PendingEmailChange;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Mi cuenta (mockup 21): the signed-in user's own name and login email.
 * The email is the login and where alerts go, so it changes in two steps:
 * current password plus the new address, then a 6-digit code sent to that
 * address. Nothing on the user changes until the code is confirmed.
 */
class AccountProfileController extends Controller
{
    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $user->forceFill(['first_name' => trim($validated['first_name']), 'last_name' => trim($validated['last_name'])])->save();

        return response()->json(['data' => $this->profile($user)]);
    }

    /** The change awaiting its code in this session, so a reopened tab resumes on step 2. */
    public function showEmailChange(Request $request): JsonResponse
    {
        $pending = $this->pendingFor($request);

        return response()->json(['data' => $pending?->codeExpiresAt->isFuture() ? $pending->summary() : null]);
    }

    public function requestEmailChange(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($request->user()->id)],
        ]);
        $email = mb_strtolower(trim($validated['email']));
        $user = $request->user();

        if ($email === mb_strtolower($user->email)) {
            throw ValidationException::withMessages(['email' => 'Ese ya es tu correo de acceso.']);
        }
        abort_if(RateLimiter::increment('email-change:'.$user->id, 3600) > 5, 429, 'Has solicitado varios códigos. Inténtalo más tarde.');

        return response()->json(['data' => $this->issue($request, $user, $email)->summary()]);
    }

    public function resendEmailChange(Request $request): JsonResponse
    {
        $pending = $this->pendingFor($request);
        abort_unless($pending, 410, 'Vuelve a iniciar el cambio de correo.');
        abort_if($pending->inResendCooldown(), 429, 'Espera 30 segundos antes de solicitar otro código.');
        abort_if(RateLimiter::increment('email-change:'.$request->user()->id, 3600) > 5, 429, 'Has solicitado varios códigos. Inténtalo más tarde.');

        return response()->json(['data' => $this->issue($request, $request->user(), $pending->email)->summary()]);
    }

    public function verifyEmailChange(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'regex:/^[0-9]{6}$/']]);
        $pending = $this->pendingFor($request);
        abort_unless($pending, 410, 'Vuelve a iniciar el cambio de correo.');

        $error = $this->checkCode($pending, $request->input('code'));
        $pending->save($request->session());
        if ($error) {
            throw ValidationException::withMessages(['code' => $error]);
        }

        $user = $request->user();
        // The address may have been taken while the code was in flight.
        if (User::query()->where('email', $pending->email)->whereKeyNot($user->id)->exists()) {
            PendingEmailChange::forget($request->session());
            throw ValidationException::withMessages(['code' => 'Ese correo ya tiene una cuenta. Inicia el cambio con otro.']);
        }

        $previous = $user->email;
        $user->forceFill(['email' => $pending->email, 'email_verified_at' => now()])->save();
        PendingEmailChange::forget($request->session());
        // The old inbox is the one an attacker would not control: tell it.
        Notification::route('mail', $previous)->notify(new EmailChangedNotification($user->first_name, $previous, $pending->email));

        return response()->json(['data' => $this->profile($user)]);
    }

    public function cancelEmailChange(Request $request): Response
    {
        PendingEmailChange::forget($request->session());

        return response()->noContent();
    }

    private function issue(Request $request, User $user, string $email): PendingEmailChange
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $pending = PendingEmailChange::issue($user->id, $email, Hash::make($code));
        $pending->save($request->session());
        Notification::route('mail', $email)->notify(new EmailChangeCodeNotification($user->first_name, $code));

        return $pending;
    }

    /** Only this user's pending change counts; a session reused by another login starts clean. */
    private function pendingFor(Request $request): ?PendingEmailChange
    {
        $pending = PendingEmailChange::fromSession($request->session());
        if ($pending && $pending->userId !== $request->user()->id) {
            PendingEmailChange::forget($request->session());

            return null;
        }

        return $pending;
    }

    private function checkCode(PendingEmailChange $pending, string $code): ?string
    {
        if ($pending->attempts >= PendingEmailChange::MAX_ATTEMPTS) {
            return 'Demasiados intentos. Solicita un código nuevo.';
        }
        if (! $pending->codeExpiresAt->isFuture()) {
            return 'El código venció. Solicita uno nuevo.';
        }
        $pending->attempts++;
        if ($pending->codeHash === null || ! Hash::check($code, $pending->codeHash)) {
            return 'El código no es correcto. Inténtalo otra vez.';
        }
        $pending->codeHash = null;

        return null;
    }

    /** @return array<string, string> */
    private function profile(User $user): array
    {
        return ['id' => $user->id, 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'name' => $user->name, 'email' => $user->email];
    }
}
