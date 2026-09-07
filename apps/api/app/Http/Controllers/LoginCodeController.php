<?php

namespace App\Http\Controllers;

use App\Http\Requests\RequestLoginCodeRequest;
use App\Http\Requests\VerifyLoginCodeRequest;
use App\Models\User;
use App\Notifications\LoginCodeNotification;
use App\Services\AccessContextService;
use App\Support\PendingLoginCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Passwordless login: a 6-digit code emailed to an existing, active account.
 * Fortify's OTP is authenticator-app 2FA, so this flow is ours; it mirrors
 * the registration OTP (session-held, hashed, 10 minutes, 5 attempts).
 */
class LoginCodeController extends Controller
{
    /**
     * The outstanding request in this session, so a returning tab lands on the
     * code step instead of asking for a fresh code. Reports the pending entry
     * whether or not an account exists behind the email: revealing that here
     * would undo the enumeration protection of the request endpoint.
     */
    public function show(Request $request): JsonResponse
    {
        $pending = PendingLoginCode::fromSession($request->session());
        if ($request->user() || ! $pending?->codeExpiresAt->isFuture()) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => $pending->summary()]);
    }

    /** Always answers as if a code was sent; only real, active accounts get one. */
    public function request(RequestLoginCodeRequest $request): JsonResponse
    {
        $email = mb_strtolower(trim($request->validated('email')));
        $previous = PendingLoginCode::fromSession($request->session());
        abort_if($previous?->email === $email && $previous->inResendCooldown(), 429, 'Espera 30 segundos antes de solicitar otro código.');
        abort_if(RateLimiter::increment('login-code:'.hash('sha256', $email), 3600) > 5, 429, 'Has solicitado varios códigos. Inténtalo más tarde.');

        $user = User::query()->where('email', $email)->whereNull('deactivated_at')->first();
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $pending = PendingLoginCode::issue($email, $user ? Hash::make($code) : null);
        $pending->save($request->session());

        if ($user) {
            Notification::route('mail', $email)->notify(new LoginCodeNotification($code));
        }

        return response()->json(['data' => $pending->summary()]);
    }

    public function verify(VerifyLoginCodeRequest $request, AccessContextService $context): JsonResponse
    {
        $pending = PendingLoginCode::fromSession($request->session());
        abort_unless($pending, 410, 'Solicita un código para ingresar.');

        $error = $this->checkCode($pending, $request->validated('code'));
        $pending->save($request->session());
        if ($error) {
            throw ValidationException::withMessages(['code' => $error]);
        }

        $user = User::query()->where('email', $pending->email)->whereNull('deactivated_at')->first();
        // The account vanished or was deactivated between request and verify.
        if (! $user) {
            throw ValidationException::withMessages(['code' => 'El código no es correcto. Inténtalo otra vez.']);
        }

        PendingLoginCode::forget($request->session());
        Auth::guard('web')->login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return response()->json(['session' => $context->sync($user, $request)]);
    }

    /** Returns null when the code is accepted, otherwise the message for the client. */
    private function checkCode(PendingLoginCode $pending, string $code): ?string
    {
        if ($pending->attempts >= PendingLoginCode::MAX_ATTEMPTS) {
            return 'Demasiados intentos. Solicita un código nuevo.';
        }
        if (! $pending->codeExpiresAt->isFuture()) {
            return 'El código venció. Solicita uno nuevo.';
        }
        $pending->attempts++;
        // A null hash (no account behind the email) fails like a wrong code.
        if ($pending->codeHash === null || ! Hash::check($code, $pending->codeHash)) {
            return 'El código no es correcto. Inténtalo otra vez.';
        }
        $pending->codeHash = null;

        return null;
    }
}
