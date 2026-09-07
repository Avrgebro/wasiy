<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Session\Session;

/**
 * The in-flight signup between "Crear cuenta" and "Comenzar prueba gratis".
 * It lives in the session, never in the database: no User exists until the
 * email is verified and the account is provisioned. Route::block() serializes
 * requests per session, so the attempt counter needs no row lock.
 */
final class PendingRegistration
{
    public const SESSION_KEY = 'registration';

    public const LIFETIME_HOURS = 24;

    public const CODE_LIFETIME_MINUTES = 10;

    public const RESEND_COOLDOWN_SECONDS = 30;

    public const MAX_ATTEMPTS = 5;

    public function __construct(
        public readonly string $firstName,
        public readonly string $lastName,
        public readonly string $email,
        public ?string $passwordHash,
        public readonly CarbonImmutable $termsAcceptedAt,
        public readonly CarbonImmutable $expiresAt,
        public ?string $codeHash = null,
        public ?CarbonImmutable $codeSentAt = null,
        public ?CarbonImmutable $codeExpiresAt = null,
        public int $attempts = 0,
        public ?CarbonImmutable $verifiedAt = null,
    ) {}

    public static function start(string $firstName, string $lastName, string $email, string $passwordHash): self
    {
        return new self($firstName, $lastName, $email, $passwordHash, CarbonImmutable::now(), CarbonImmutable::now()->addHours(self::LIFETIME_HOURS));
    }

    /** The current, unexpired registration in this session, if any. */
    public static function fromSession(Session $session): ?self
    {
        $data = $session->get(self::SESSION_KEY);
        if (! is_array($data)) {
            return null;
        }
        $at = fn (?string $value): ?CarbonImmutable => $value === null ? null : CarbonImmutable::parse($value);
        $pending = new self(
            $data['first_name'], $data['last_name'], $data['email'], $data['password_hash'],
            $at($data['terms_accepted_at']), $at($data['expires_at']),
            $data['code_hash'], $at($data['code_sent_at']), $at($data['code_expires_at']), (int) $data['attempts'], $at($data['verified_at']),
        );

        return $pending->expiresAt->isFuture() ? $pending : null;
    }

    public function save(Session $session): void
    {
        $iso = fn (?CarbonImmutable $value): ?string => $value?->toIso8601String();
        $session->put(self::SESSION_KEY, [
            'first_name' => $this->firstName, 'last_name' => $this->lastName, 'email' => $this->email,
            'password_hash' => $this->passwordHash, 'terms_accepted_at' => $iso($this->termsAcceptedAt), 'expires_at' => $iso($this->expiresAt),
            'code_hash' => $this->codeHash, 'code_sent_at' => $iso($this->codeSentAt), 'code_expires_at' => $iso($this->codeExpiresAt),
            'attempts' => $this->attempts, 'verified_at' => $iso($this->verifiedAt),
        ]);
    }

    public static function forget(Session $session): void
    {
        $session->forget(self::SESSION_KEY);
    }

    public function isVerified(): bool
    {
        return $this->verifiedAt !== null;
    }

    public function inResendCooldown(): bool
    {
        return $this->codeSentAt?->gt(now()->subSeconds(self::RESEND_COOLDOWN_SECONDS)) ?? false;
    }

    /** Seconds until another code may be requested; 0 when allowed now. */
    public function resendAfter(): int
    {
        return max(0, (int) ceil(now()->diffInSeconds($this->codeSentAt?->addSeconds(self::RESEND_COOLDOWN_SECONDS), false)));
    }

    /** What the client may see: never the hashes. */
    public function summary(): array
    {
        return ['first_name' => $this->firstName, 'last_name' => $this->lastName, 'email' => $this->email, 'verified' => $this->isVerified(), 'resend_after' => $this->resendAfter()];
    }
}
