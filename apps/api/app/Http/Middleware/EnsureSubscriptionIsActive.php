<?php

namespace App\Http\Middleware;

use App\Models\Account;
use App\Models\User;
use App\Services\AccessContextService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Staff endpoints stop answering once the active Account's subscription has
 * lapsed. /me and the context endpoints sit outside this gate so the SPA can
 * still read the state and land on the subscription page; the resident
 * portal is never gated (ADR 0039).
 */
class EnsureSubscriptionIsActive
{
    public const ERROR_CODE = 'subscription_lapsed';

    public function __construct(private readonly AccessContextService $context) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $account = $user instanceof User ? $this->context->activeAccountOrSingle($request, $user) : null;

        if ($account instanceof Account && $account->subscription?->isLapsed()) {
            return response()->json([
                'message' => 'La suscripción de esta cuenta venció. Renuévala para seguir usando Wasiy.',
                'code' => self::ERROR_CODE,
            ], Response::HTTP_PAYMENT_REQUIRED);
        }

        return $next($request);
    }
}
