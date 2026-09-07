<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Session\Session;

/**
 * A login-email change waiting for its code (mockup 21, "Correo de acceso").
 * Session-held like the registration and login codes: the new address is
 * hashed-code-gated and nothing on the user changes until it is confirmed.
 */
final class PendingEmailChange
{
    public const SESSION_KEY = 'email_change';

    public const CODE_LIFETIME_MINUTES = PendingRegistration::CODE_LIFETIME_MINUTES;

    public const RESEND_COOLDOWN_SECONDS = PendingRegistration::RESEND_COOLDOWN_SECONDS;

    public const MAX_ATTEMPTS = PendingRegistration::MAX_ATTEMPTS;

    public function __construct(
        public readonly string $userId,
        public readonly string $email,
        public ?string $codeHash,
        public readonly CarbonImmutable $codeSentAt,
        public readonly CarbonImmutable $codeExpiresAt,
        public int $attempts = 0,
    ) {}

    public static function issue(string $userId, string $email, string $codeHash): self
    {
        return new self($userId, $email, $codeHash, CarbonImmutable::now(), CarbonImmutable::now()->addMinutes(self::CODE_LIFETIME_MINUTES));
    }

    public static function fromSession(Session $session): ?self
    {
        $data = $session->get(self::SESSION_KEY);
        if (! is_array($data)) {
            return null;
        }

        return new self(
            $data['user_id'], $data['email'], $data['code_hash'],
            CarbonImmutable::parse($data['code_sent_at']), CarbonImmutable::parse($data['code_expires_at']),
            (int) $data['attempts'],
        );
    }

    public function save(Session $session): void
    {
        $session->put(self::SESSION_KEY, [
            'user_id' => $this->userId, 'email' => $this->email, 'code_hash' => $this->codeHash,
            'code_sent_at' => $this->codeSentAt->toIso8601String(), 'code_expires_at' => $this->codeExpiresAt->toIso8601String(),
            'attempts' => $this->attempts,
        ]);
    }

    public static function forget(Session $session): void
    {
        $session->forget(self::SESSION_KEY);
    }

    public function inResendCooldown(): bool
    {
        return $this->codeSentAt->gt(now()->subSeconds(self::RESEND_COOLDOWN_SECONDS));
    }

    public function resendAfter(): int
    {
        return max(0, (int) ceil(now()->diffInSeconds($this->codeSentAt->addSeconds(self::RESEND_COOLDOWN_SECONDS), false)));
    }

    /** What the client may see: the address awaiting confirmation, never the hash. */
    public function summary(): array
    {
        return ['email' => $this->email, 'resend_after' => $this->resendAfter()];
    }
}
