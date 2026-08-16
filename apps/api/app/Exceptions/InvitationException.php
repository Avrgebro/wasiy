<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/**
 * Domain failures in the invitation accept/claim flows. Each named
 * constructor is one business outcome; render() owns the HTTP mapping in
 * one place, so Actions never abort() with raw status codes.
 */
class InvitationException extends Exception
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
