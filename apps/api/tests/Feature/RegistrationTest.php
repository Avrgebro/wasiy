<?php

use App\Actions\Locations\CreateLocation;
use App\Models\Account;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\RegistrationCodeNotification;
use App\Support\PendingRegistration;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);
beforeEach(function () {
    Cache::flush();
    Notification::fake();
    $this->seed(PlanSeeder::class);
});
function registrationInput(array $overrides = []): array
{
    return [...['first_name' => 'Ana', 'last_name' => 'Torres', 'email' => 'ana@example.com', 'password' => 'safe-password', 'password_confirmation' => 'safe-password', 'terms_accepted' => true], ...$overrides];
}
function buildingInput(array $overrides = []): array
{
    return [...['name' => 'Edificio Central', 'address' => 'Av. Central 123', 'district' => 'San Isidro', 'city' => 'Lima', 'country' => 'PE', 'units' => 40, 'plan' => 'operativo', 'unit_price_minor' => 650], ...$overrides];
}
function registrationCode(): string
{
    $code = '';
    Notification::assertSentOnDemand(RegistrationCodeNotification::class, function ($notification) use (&$code) {
        $code = $notification->code;

        return true;
    });

    return $code;
}
function pendingRegistration(): array
{
    return session(PendingRegistration::SESSION_KEY);
}
it('atomically provisions a trial and active context only after verification', function () {
    $this->postJson('/registration', registrationInput())->assertCreated()->assertJsonPath('data.verified', false);
    expect(User::count())->toBe(0)->and(Account::count())->toBe(0);
    expect(Hash::check('safe-password', pendingRegistration()['password_hash']))->toBeTrue();
    $this->postJson('/registration/verify', ['code' => registrationCode()])->assertOk()->assertJsonPath('data.verified', true);
    $this->postJson('/registration/complete', buildingInput())->assertOk()->assertJsonPath('session.active_location.name', 'Edificio Central');
    $this->assertAuthenticatedAs(User::sole());
    expect(Hash::check('safe-password', User::sole()->password))->toBeTrue()->and(User::sole()->email_verified_at)->not->toBeNull();
    $account = Account::sole();
    $location = $account->locations()->first();
    expect($account->locations()->count())->toBe(1)->and($location->buildings()->count())->toBe(1)
        ->and($location->district)->toBe('San Isidro')->and($location->country)->toBe('PE')
        ->and($account->staffMemberships()->first()->account_role->value)->toBe('account_admin');
    $subscription = Subscription::sole();
    expect($subscription->unit_price_minor)->toBe(650)->and($subscription->billable_units)->toBe(40)
        ->and($subscription->trial_starts_at->diffInDays($subscription->trial_ends_at))->toBe(14.0)
        ->and(session()->has(PendingRegistration::SESSION_KEY))->toBeFalse();
    $this->postJson('/registration/complete', buildingInput())->assertOk();
    expect(Account::count())->toBe(1)->and(Subscription::count())->toBe(1);
    $this->getJson('/api/me')->assertOk()->assertJsonPath('active_account.id', $account->id);
});
it('bills the included units when a building has fewer', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $this->postJson('/registration/verify', ['code' => registrationCode()])->assertOk();
    $this->postJson('/registration/complete', buildingInput(['units' => 6]))->assertOk();
    expect(Subscription::sole()->billable_units)->toBe(10);
    $this->getJson('/api/public/plans')->assertJsonPath('data.0.included_units', 10);
});
it('requires district and a supported country for the first building', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $this->postJson('/registration/verify', ['code' => registrationCode()])->assertOk();
    $this->postJson('/registration/complete', buildingInput(['district' => '']))->assertUnprocessable()->assertJsonValidationErrors('district');
    $this->postJson('/registration/complete', buildingInput(['country' => 'US']))->assertUnprocessable()->assertJsonValidationErrors('country');
    expect(Account::count())->toBe(0);
});
it('requires password confirmation and rejects existing emails', function () {
    $this->postJson('/registration', registrationInput(['password_confirmation' => 'different']))->assertUnprocessable()->assertJsonValidationErrors('password');
    $this->postJson('/registration', registrationInput(['email' => 'jose@wasiy']))->assertUnprocessable()->assertJsonValidationErrors('email');
    User::factory()->create(['email' => 'ana@example.com']);
    $this->postJson('/registration', registrationInput())->assertUnprocessable()->assertJsonValidationErrors('email');
    expect(session()->has(PendingRegistration::SESSION_KEY))->toBeFalse();
});
it('rejects unverified completion, expired codes, and expired drafts', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $code = registrationCode();
    $this->postJson('/registration/complete', buildingInput())->assertUnprocessable()->assertJsonValidationErrors('code');
    $this->travel(11)->minutes();
    $this->postJson('/registration/verify', ['code' => $code])->assertUnprocessable()->assertJsonValidationErrors('code');
    $this->travel(25)->hours();
    $this->postJson('/registration/complete', buildingInput())->assertGone();
    expect(Account::count())->toBe(0);
});
it('persists failed attempts and enforces resend cooldown', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $code = registrationCode();
    $wrong = $code === '000000' ? '111111' : '000000';
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/registration/verify', ['code' => $wrong])->assertUnprocessable();
    }
    $this->postJson('/registration/verify', ['code' => $code])->assertUnprocessable();
    expect(pendingRegistration()['attempts'])->toBe(5);
    $this->postJson('/registration/resend')->assertTooManyRequests();
});
it('revokes old codes on resend and binds verification to the session', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $oldCode = registrationCode();
    $this->travel(31)->seconds();
    Notification::fake();
    $this->postJson('/registration/resend')->assertOk();
    $newCode = registrationCode();
    expect(Hash::check($newCode, pendingRegistration()['code_hash']))->toBeTrue();
    if ($newCode !== $oldCode) {
        $this->postJson('/registration/verify', ['code' => $oldCode])->assertUnprocessable();
    }
    $this->withSession([PendingRegistration::SESSION_KEY => null])->postJson('/registration/verify', ['code' => $newCode])->assertGone();
});
it('rejects stale prices without partial records and allows retry', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $this->postJson('/registration/verify', ['code' => registrationCode()])->assertOk();
    $this->postJson('/registration/complete', buildingInput(['unit_price_minor' => 1]))->assertUnprocessable()->assertJsonValidationErrors('plan');
    expect(User::count())->toBe(0)->and(Account::count())->toBe(0);
    $this->postJson('/registration/complete', buildingInput())->assertOk();
});
it('returns public prices and resumable state without credentials', function () {
    $this->getJson('/api/public/plans')->assertOk()->assertJsonPath('data.0.unit_price_minor', 450);
    $this->postJson('/registration', registrationInput())->assertCreated();
    $response = $this->getJson('/registration')->assertOk()->assertJsonPath('data.email', 'ana@example.com');
    expect($response->json('data'))->not->toHaveKeys(['code_hash', 'password_hash']);
    Plan::where('code', 'operativo')->update(['is_available' => false]);
    $this->getJson('/api/public/plans')->assertJsonCount(1, 'data');
});

it('validates multibyte password lengths without throwing', function () {
    $password = str_repeat('ñ', 40);
    $this->postJson('/registration', registrationInput(['password' => $password, 'password_confirmation' => $password]))->assertUnprocessable()->assertJsonValidationErrors('password');
});
it('does not claim an existing identity created after verification', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $this->postJson('/registration/verify', ['code' => registrationCode()])->assertOk();
    $existing = User::factory()->create(['email' => 'ana@example.com']);
    $this->postJson('/registration/complete', buildingInput())->assertUnprocessable()->assertJsonValidationErrors('email');
    expect(Account::count())->toBe(0)->and(Subscription::count())->toBe(0)->and(User::sole()->id)->toBe($existing->id);
    $this->assertGuest();
});

it('rolls back all provisioning when location creation fails', function () {
    $this->postJson('/registration', registrationInput())->assertCreated();
    $this->postJson('/registration/verify', ['code' => registrationCode()])->assertOk();
    $this->mock(CreateLocation::class, function ($mock) {
        $mock->shouldReceive('handle')->once()->andThrow(new RuntimeException('Simulated location failure'));
    });
    $this->postJson('/registration/complete', buildingInput())->assertStatus(500);
    expect(Account::count())->toBe(0)->and(User::count())->toBe(0)->and(Subscription::count())->toBe(0)
        ->and(pendingRegistration()['verified_at'])->not->toBeNull();
    $this->assertGuest();
});

it('limits email delivery across restarts and preserves the last valid state on rejection', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/registration', registrationInput())->assertCreated();
        $this->travel(61)->seconds();
    }
    $before = pendingRegistration();
    $this->postJson('/registration', registrationInput(['first_name' => 'Otra']))->assertTooManyRequests();
    expect(pendingRegistration())->toBe($before);
});
