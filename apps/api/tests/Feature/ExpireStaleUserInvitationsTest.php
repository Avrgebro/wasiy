<?php

use App\Enums\UserInvitationStatus;
use App\Models\UserInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('the expire stale invitations command only expires pending invitations past their expiry', function () {
    $staleInvitation = UserInvitation::factory()->create([
        'status' => UserInvitationStatus::Pending,
        'expires_at' => now()->subMinute(),
    ]);

    $freshInvitation = UserInvitation::factory()->create([
        'status' => UserInvitationStatus::Pending,
        'expires_at' => now()->addDay(),
    ]);

    $acceptedInvitation = UserInvitation::factory()->create([
        'status' => UserInvitationStatus::Accepted,
        'accepted_at' => now()->subDay(),
        'expires_at' => now()->subMinute(),
    ]);

    $this->artisan('invitations:expire-stale')->assertSuccessful();

    expect($staleInvitation->fresh()->status)->toBe(UserInvitationStatus::Expired)
        ->and($freshInvitation->fresh()->status)->toBe(UserInvitationStatus::Pending)
        ->and($acceptedInvitation->fresh()->status)->toBe(UserInvitationStatus::Accepted);
});
