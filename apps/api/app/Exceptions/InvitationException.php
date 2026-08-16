<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;

/**
 * Domain failures in the invitation accept/claim flows. Each named
 * constructor is one business outcome; render() owns the HTTP mapping in
 * one place, so Actions never abort() with raw status codes. Implements
 * ShouldntReport because every case is an expected user-facing outcome,
 * not an error worth a stack trace in the logs.
 */
class InvitationException extends Exception implements ShouldntReport
{
    private function __construct(
        string $message,
        private readonly int $status,
    ) {
        parent::__construct($message);
    }

    public static function noLongerValid(): self
    {
        return new self(__('This invitation is no longer valid.'), 410);
    }

    public static function requiresAuthentication(): self
    {
        return new self(__('Sign in as the invited user to accept this invitation.'), 401);
    }

    public static function belongsToAnotherUser(): self
    {
        return new self(__('This invitation belongs to a different user.'), 409);
    }

    public static function userDeactivated(): self
    {
        return new self(__('This user is deactivated.'), 403);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->status);
    }
}
