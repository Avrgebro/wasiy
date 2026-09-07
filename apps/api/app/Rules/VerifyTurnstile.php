<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Cloudflare Turnstile server-side check (siteverify). Inactive until
 * TURNSTILE_SECRET is configured, so local and test environments run without
 * a widget. Once set, a token must be accepted by Cloudflare, carry the
 * action the widget was rendered with, and, when TURNSTILE_HOSTNAMES is set,
 * come from one of those frontend hostnames.
 */
class VerifyTurnstile implements ValidationRule
{
    public const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    private const MESSAGE = 'No pudimos verificar que eres una persona. Recarga la página e inténtalo otra vez.';

    /**
     * @param  string|null  $expectedAction  The widget's data-action; null skips the check.
     */
    public function __construct(private readonly ?string $expectedAction = null, private readonly ?string $remoteIp = null) {}

    public static function enabled(): bool
    {
        return filled(config('services.turnstile.secret'));
    }

    /** @return list<string> */
    public static function allowedHostnames(): array
    {
        return array_values(array_filter(array_map(
            fn (string $host): string => strtolower(trim($host)),
            explode(',', (string) config('services.turnstile.hostnames')),
        )));
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::enabled()) {
            return;
        }
        if (! is_string($value) || $value === '') {
            $fail(self::MESSAGE);

            return;
        }
        try {
            $response = Http::asForm()->timeout(5)->post(self::VERIFY_URL, array_filter([
                'secret' => config('services.turnstile.secret'),
                'response' => $value,
                'remoteip' => $this->remoteIp,
            ]));
            $ok = $response->successful() && $response->json('success') === true
                && $this->actionMatches($response->json('action'))
                && $this->hostnameAllowed($response->json('hostname'));
            if (! $ok && $response->successful()) {
                Log::info('Turnstile rejected a token', ['error-codes' => $response->json('error-codes'), 'action' => $response->json('action'), 'hostname' => $response->json('hostname')]);
            }
        } catch (\Throwable $exception) {
            Log::warning('Turnstile verification unavailable', ['error' => $exception->getMessage()]);
            $ok = false;
        }
        if (! $ok) {
            $fail(self::MESSAGE);
        }
    }

    private function actionMatches(mixed $action): bool
    {
        return $this->expectedAction === null || $action === $this->expectedAction;
    }

    private function hostnameAllowed(mixed $hostname): bool
    {
        $allowed = self::allowedHostnames();

        return $allowed === [] || (is_string($hostname) && in_array(strtolower($hostname), $allowed, true));
    }
}
