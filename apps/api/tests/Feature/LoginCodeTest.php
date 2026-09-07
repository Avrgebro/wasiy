<?php

use App\Models\User;
use App\Notifications\LoginCodeNotification;
use App\Support\PendingLoginCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
    Notification::fake();
});

function loginCode(): string
{
    $code = '';
    Notification::assertSentOnDemand(LoginCodeNotification::class, function ($notification) use (&$code) {
        $code = $notification->code;

        return true;
    });

    return $code;
}

function rememberCookie($response)
{
    return collect($response->headers->getCookies())->first(fn ($c) => str_starts_with($c->getName(), 'remember_web_'));
}

it('emails a code to an active account and logs in with it, honoring remember', function () {
    $user = User::factory()->create(['email' => 'ana@example.com']);

    $this->postJson('/login/code/request', ['email' => 'Ana@Example.com'])
        ->assertOk()->assertJsonPath('data.email', 'ana@example.com')->assertJsonPath('data.resend_after', 30);

    $response = $this->postJson('/login/code/verify', ['code' => loginCode(), 'remember' => true])->assertOk();
    $this->assertAuthenticatedAs($user);
    expect($response->json('session.user.email'))->toBe('ana@example.com')
        ->and(rememberCookie($response))->not->toBeNull()
        ->and(session(PendingLoginCode::SESSION_KEY))->toBeNull();
});

it('does not set the remember cookie when remember is false', function () {
    User::factory()->create(['email' => 'ana@example.com']);
    $this->postJson('/login/code/request', ['email' => 'ana@example.com'])->assertOk();

    $response = $this->postJson('/login/code/verify', ['code' => loginCode(), 'remember' => false])->assertOk();
    expect(rememberCookie($response))->toBeNull();
});

it('answers identically for unknown and deactivated emails without sending anything', function () {
    $deactivated = User::factory()->create(['email' => 'off@example.com']);
    $deactivated->deactivate();

    $this->postJson('/login/code/request', ['email' => 'nobody@example.com'])->assertOk()->assertJsonPath('data.email', 'nobody@example.com');
    $this->postJson('/login/code/verify', ['code' => '123456'])->assertStatus(422)->assertJsonPath('errors.code.0', 'El código no es correcto. Inténtalo otra vez.');

    // A different email in the same session is not the same-email cooldown.
    $this->postJson('/login/code/request', ['email' => 'off@example.com'])->assertOk();
    Notification::assertNothingSent();
    $this->assertGuest();
});

it('rejects wrong codes, locks after five attempts, and enforces the resend cooldown', function () {
    User::factory()->create(['email' => 'ana@example.com']);
    $this->postJson('/login/code/request', ['email' => 'ana@example.com'])->assertOk();
    $code = loginCode();
    $wrong = $code === '000000' ? '000001' : '000000';

    foreach (range(1, 5) as $i) {
        $this->postJson('/login/code/verify', ['code' => $wrong])->assertStatus(422)->assertJsonPath('errors.code.0', 'El código no es correcto. Inténtalo otra vez.');
    }
    $this->postJson('/login/code/verify', ['code' => $code])->assertStatus(422)->assertJsonPath('errors.code.0', 'Demasiados intentos. Solicita un código nuevo.');
    $this->assertGuest();

    $this->postJson('/login/code/request', ['email' => 'ana@example.com'])->assertStatus(429);
    $this->travel(31)->seconds();
    $this->postJson('/login/code/request', ['email' => 'ana@example.com'])->assertOk();
    $this->postJson('/login/code/verify', ['code' => loginCode()])->assertOk();
    $this->assertAuthenticated();
});

it('rejects expired codes and requires a pending request', function () {
    $this->postJson('/login/code/verify', ['code' => '123456'])->assertStatus(410);

    User::factory()->create(['email' => 'ana@example.com']);
    $this->postJson('/login/code/request', ['email' => 'ana@example.com'])->assertOk();
    $code = loginCode();
    $this->travel(11)->minutes();
    $this->postJson('/login/code/verify', ['code' => $code])->assertStatus(422)->assertJsonPath('errors.code.0', 'El código venció. Solicita uno nuevo.');
    $this->assertGuest();
});

it('resumes an outstanding request for a returning tab without revealing whether the account exists', function () {
    $this->getJson('/login/code')->assertOk()->assertJsonPath('data', null);

    User::factory()->create(['email' => 'ana@example.com']);
    $this->postJson('/login/code/request', ['email' => 'ana@example.com'])->assertOk();
    $this->getJson('/login/code')->assertOk()->assertJsonPath('data.email', 'ana@example.com')->assertJsonPath('data.resend_after', 30);
    $this->travel(31)->seconds();
    $this->getJson('/login/code')->assertOk()->assertJsonPath('data.resend_after', 0);
    $this->travel(10)->minutes();
    $this->getJson('/login/code')->assertOk()->assertJsonPath('data', null);

    $this->flushSession();
    $this->postJson('/login/code/request', ['email' => 'nobody@example.com'])->assertOk();
    $this->getJson('/login/code')->assertOk()->assertJsonPath('data.email', 'nobody@example.com');
});

it('renders the branded login code email', function () {
    $mail = (new LoginCodeNotification('482913'))->toMail(new AnonymousNotifiable);
    $html = (string) $mail->render();

    expect($mail->subject)->toBe('Tu código de acceso a Wasiy')
        ->and($html)->toContain('482913')->toContain('Tu código de acceso')->toContain('10 minutos')->not->toContain('{{');
});
