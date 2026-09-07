<?php

namespace App\Http\Controllers;

use App\Actions\Registration\CompleteRegistration;
use App\Actions\Registration\SendRegistrationCode;
use App\Http\Requests\CompleteRegistrationRequest;
use App\Http\Requests\StartRegistrationRequest;
use App\Http\Requests\VerifyRegistrationRequest;
use App\Models\Plan;
use App\Services\AccessContextService;
use App\Support\PendingRegistration;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class RegistrationController extends Controller
{
    public function plans(): JsonResponse
    {
        // Self-serve plans are whatever is available; Portafolio is never
        // seeded as available because it is sold through the sales team.
        return response()->json(['data' => Plan::where('is_available', true)->orderBy('unit_price_minor')
            ->get(['code', 'name', 'unit_price_minor', 'currency', 'features', 'location_limit', 'included_units'])]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => PendingRegistration::fromSession($request->session())?->summary()]);
    }

    public function store(StartRegistrationRequest $request, SendRegistrationCode $send): JsonResponse
    {
        $old = PendingRegistration::fromSession($request->session());
        abort_if($old?->inResendCooldown(), 429, 'Espera 30 segundos antes de solicitar otro código.');
        $data = $request->validated();
        $pending = PendingRegistration::start($data['first_name'], $data['last_name'], $data['email'], Hash::make($data['password']));
        // The send may abort on the per-email limit; the previous state stays intact then.
        $send->handle($pending);
        $pending->save($request->session());

        return response()->json(['data' => $pending->summary()], 201);
    }

    public function resend(Request $request, SendRegistrationCode $send): JsonResponse
    {
        abort_if($request->user(), 403);
        $pending = $this->pending($request);
        abort_if($pending->isVerified(), 409, 'El correo ya está confirmado.');
        $send->handle($pending);
        $pending->save($request->session());

        return response()->json(['data' => $pending->summary()]);
    }

    public function verify(VerifyRegistrationRequest $request): JsonResponse
    {
        $pending = $this->pending($request);
        if (! $pending->isVerified()) {
            $error = $this->checkCode($pending, $request->validated('code'));
            $pending->save($request->session());
            if ($error) {
                throw ValidationException::withMessages(['code' => $error]);
            }
        }

        return response()->json(['data' => $pending->summary()]);
    }

    public function complete(CompleteRegistrationRequest $request, CompleteRegistration $complete, AccessContextService $context): JsonResponse
    {
        // A replay after success: the signup is done and the user is logged in.
        if ($request->user()) {
            return response()->json(['session' => $context->sync($request->user(), $request)]);
        }
        $pending = $this->pending($request);
        try {
            $user = DB::transaction(fn () => $complete->handle($pending, $request->validated()));
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => 'Este correo ya tiene una cuenta. Inicia sesión.']);
        }
        PendingRegistration::forget($request->session());
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json(['session' => $context->sync($user, $request)]);
    }

    /** Returns null when the code is accepted, otherwise the message for the client. */
    private function checkCode(PendingRegistration $pending, string $code): ?string
    {
        if ($pending->attempts >= PendingRegistration::MAX_ATTEMPTS) {
            return 'Demasiados intentos. Solicita un código nuevo.';
        }
        if (! $pending->codeExpiresAt?->isFuture()) {
            return 'El código venció. Solicita uno nuevo.';
        }
        $pending->attempts++;
        if (! Hash::check($code, $pending->codeHash)) {
            return 'El código no es correcto. Inténtalo otra vez.';
        }
        $pending->verifiedAt = now()->toImmutable();
        $pending->codeHash = null;

        return null;
    }

    private function pending(Request $request): PendingRegistration
    {
        $pending = PendingRegistration::fromSession($request->session());
        abort_unless($pending, 410, 'Tu registro venció. Vuelve a ingresar tus datos.');

        return $pending;
    }
}
