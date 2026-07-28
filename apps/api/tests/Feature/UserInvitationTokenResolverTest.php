<?php

use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Resident;
use App\Models\UserInvitation;
use App\Services\UserInvitationTokenResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

function makeInvitation(string $token, UserInvitationPurpose $purpose, array $attributes = []): UserInvitation
{
    $resident = Resident::factory()->create();

    return UserInvitation::factory()->for($resident->account)->for($resident)->create([
        'email' => 'token.holder@wasiy.test',
        'first_name' => $resident->first_name,
        'last_name' => $resident->last_name,
        'token_hash' => hash('sha256', $token),
        'purpose' => $purpose,
        'status' => UserInvitationStatus::Pending,
        'expires_at' => now()->addDay(),
        ...$attributes,
    ]);
}

function resolveStatus(callable $callback): int
{
    try {
        $callback();
    } catch (HttpException $exception) {
        return $exception->getStatusCode();
    } catch (HttpResponseException $exception) {
        return $exception->getResponse()->getStatusCode();
    }

    return 200;
}

test('a pending token resolves for its own purpose', function () {
    $invitation = makeInvitation('good-token', UserInvitationPurpose::Resident);
    $resolver = app(UserInvitationTokenResolver::class);

    $resolved = $resolver->resolve('good-token', UserInvitationPurpose::Resident);

    expect($resolved->id)->toBe($invitation->id);
});

test('a token issued for one purpose cannot be resolved as the other', function () {
    makeInvitation('crossover-token', UserInvitationPurpose::Resident);
    $resolver = app(UserInvitationTokenResolver::class);

    $status = resolveStatus(fn () => $resolver->resolve('crossover-token', UserInvitationPurpose::Staff));

    expect($status)->toBe(410);
});

test('unknown accepted and cancelled tokens are gone', function () {
    $resolver = app(UserInvitationTokenResolver::class);

    makeInvitation('accepted-token', UserInvitationPurpose::Resident, [
        'status' => UserInvitationStatus::Accepted,
        'accepted_at' => now(),
    ]);
    makeInvitation('cancelled-token', UserInvitationPurpose::Resident, [
        'status' => UserInvitationStatus::Cancelled,
    ]);

    expect(resolveStatus(fn () => $resolver->resolve('no-such-token', UserInvitationPurpose::Resident)))->toBe(410)
        ->and(resolveStatus(fn () => $resolver->resolve('accepted-token', UserInvitationPurpose::Resident)))->toBe(410)
        ->and(resolveStatus(fn () => $resolver->resolve('cancelled-token', UserInvitationPurpose::Resident)))->toBe(410);
});

test('an overdue pending token is marked expired on read', function () {
    $invitation = makeInvitation('overdue-token', UserInvitationPurpose::Resident, [
        'expires_at' => now()->subMinute(),
    ]);
    $resolver = app(UserInvitationTokenResolver::class);

    $status = resolveStatus(fn () => $resolver->resolve('overdue-token', UserInvitationPurpose::Resident));

    expect($status)->toBe(410)
        ->and($invitation->fresh()->status)->toBe(UserInvitationStatus::Expired);
});
