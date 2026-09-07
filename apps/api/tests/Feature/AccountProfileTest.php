<?php

use App\Models\User;
use App\Notifications\EmailChangeCodeNotification;
use App\Notifications\EmailChangedNotification;
use App\Support\PendingEmailChange;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
    Notification::fake();
});

function emailChangeCode(): string
{
    $code = '';
    Notification::assertSentOnDemand(EmailChangeCodeNotification::class, function ($notification) use (&$code) {
        $code = $notification->code;

        return true;
    });

    return $code;
}

it('updates the own first and last name only', function () {
    $user = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Torres', 'email' => 'ana@example.com']);

    $this->actingAs($user)
        ->patchJson('/api/me/profile', ['first_name' => ' Ana María ', 'last_name' => 'Torres Vega', 'email' => 'other@example.com'])
        ->assertOk()
        ->assertJsonPath('data.name', 'Ana María Torres Vega')
        ->assertJsonPath('data.email', 'ana@example.com');

    $this->actingAs($user)->patchJson('/api/me/profile', ['first_name' => '', 'last_name' => 'Torres'])
        ->assertUnprocessable()->assertJsonValidationErrors(['first_name']);
});

it('changes the login email in two steps and tells the old address', function () {
    $user = User::factory()->create(['email' => 'ana@example.com', 'password' => 'safe-password']);

    $this->actingAs($user)
        ->postJson('/api/me/email/request', ['current_password' => 'safe-password', 'email' => 'Ana.New@Example.com'])
        ->assertOk()->assertJsonPath('data.email', 'ana.new@example.com')->assertJsonPath('data.resend_after', 30);

    Notification::assertSentOnDemand(EmailChangeCodeNotification::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'ana.new@example.com');
    expect($user->fresh()->email)->toBe('ana@example.com');

    $this->actingAs($user)->getJson('/api/me/email')->assertOk()->assertJsonPath('data.email', 'ana.new@example.com');

    $this->actingAs($user)
        ->postJson('/api/me/email/verify', ['code' => emailChangeCode()])
        ->assertOk()->assertJsonPath('data.email', 'ana.new@example.com');

    expect($user->fresh()->email)->toBe('ana.new@example.com')
        ->and($user->fresh()->email_verified_at)->not->toBeNull()
        ->and(session(PendingEmailChange::SESSION_KEY))->toBeNull();
    Notification::assertSentOnDemand(EmailChangedNotification::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'ana@example.com');
    $this->actingAs($user)->getJson('/api/me/email')->assertOk()->assertJsonPath('data', null);
});

it('requires the current password, a free address and a different one', function () {
    $user = User::factory()->create(['email' => 'ana@example.com', 'password' => 'safe-password']);
    User::factory()->create(['email' => 'taken@example.com']);

    $this->actingAs($user)->postJson('/api/me/email/request', ['current_password' => 'wrong', 'email' => 'new@example.com'])
        ->assertUnprocessable()->assertJsonValidationErrors(['current_password']);
    $this->actingAs($user)->postJson('/api/me/email/request', ['current_password' => 'safe-password', 'email' => 'taken@example.com'])
        ->assertUnprocessable()->assertJsonValidationErrors(['email']);
    $this->actingAs($user)->postJson('/api/me/email/request', ['current_password' => 'safe-password', 'email' => 'ANA@example.com'])
        ->assertUnprocessable()->assertJsonValidationErrors(['email']);
    Notification::assertNothingSent();
});

it('rejects wrong and expired codes, limits attempts and resends after the cooldown', function () {
    $user = User::factory()->create(['email' => 'ana@example.com', 'password' => 'safe-password']);
    $this->actingAs($user)->postJson('/api/me/email/request', ['current_password' => 'safe-password', 'email' => 'new@example.com'])->assertOk();

    $this->actingAs($user)->postJson('/api/me/email/verify', ['code' => '000000'])->assertUnprocessable()->assertJsonValidationErrors(['code']);
    $this->actingAs($user)->postJson('/api/me/email/resend')->assertStatus(429);
    $this->travel(31)->seconds();
    $this->actingAs($user)->postJson('/api/me/email/resend')->assertOk()->assertJsonPath('data.resend_after', 30);
    Notification::assertSentOnDemandTimes(EmailChangeCodeNotification::class, 2);

    $this->travel(11)->minutes();
    $this->actingAs($user)->postJson('/api/me/email/verify', ['code' => emailChangeCode()])
        ->assertUnprocessable()->assertJsonPath('errors.code.0', 'El código venció. Solicita uno nuevo.');
    expect($user->fresh()->email)->toBe('ana@example.com');
});

it('cancels a pending change and needs one to verify', function () {
    $user = User::factory()->create(['email' => 'ana@example.com', 'password' => 'safe-password']);
    $this->actingAs($user)->postJson('/api/me/email/verify', ['code' => '123456'])->assertStatus(410);

    $this->actingAs($user)->postJson('/api/me/email/request', ['current_password' => 'safe-password', 'email' => 'new@example.com'])->assertOk();
    $this->actingAs($user)->deleteJson('/api/me/email')->assertNoContent();
    $this->actingAs($user)->getJson('/api/me/email')->assertOk()->assertJsonPath('data', null);
});

it('renders both branded emails', function () {
    $code = (new EmailChangeCodeNotification('Ana', '482913'))->toMail(new AnonymousNotifiable);
    expect($code->view)->toBe('mail.maizzle.email-change-code');
    expect((string) $code->render())->toContain('482913')->toContain('Hola Ana,')->toContain('Confirma tu nuevo correo')->not->toContain('{{');

    $changed = (new EmailChangedNotification('Ana', 'ana@example.com', 'new@example.com'))->toMail(new AnonymousNotifiable);
    expect($changed->view)->toBe('mail.maizzle.email-changed');
    expect((string) $changed->render())->toContain('ana@example.com')->toContain('new@example.com')->toContain('mailto:'.config('wasiy.leads.notify_email'))->not->toContain('{{');
});
