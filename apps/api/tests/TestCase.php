<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // API routes rely on Sanctum stateful SPA authentication instead of
        // the web middleware group. Browsers always send an Origin/Referer
        // from a stateful domain; simulate that so session-backed context
        // behaves in tests exactly as it does for the real SPA.
        $this->withHeader('Referer', 'http://localhost');

        // AuthenticateSession pins the session to one user's password hash.
        // Tests that switch actingAs users within one application instance
        // trip it (production sessions only ever hold one user), so the
        // password-change logout behavior is not testable this way anyway.
        $this->withoutMiddleware(AuthenticateSession::class);
    }
}
