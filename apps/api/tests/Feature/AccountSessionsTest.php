<?php

use App\Models\User;
use App\Support\DeviceLabel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';

function sessionRow(User $user, string $id, string $agent, string $ip, int $minutesAgo): void
{
    DB::table('sessions')->insert(['id' => $id, 'user_id' => $user->id, 'ip_address' => $ip, 'user_agent' => $agent, 'payload' => '', 'last_activity' => now()->subMinutes($minutesAgo)->timestamp]);
}

it('labels devices from the user agent', function () {
    expect(DeviceLabel::from(MAC_CHROME))->toBe('Mac · Chrome')
        ->and(DeviceLabel::from(IPHONE_SAFARI))->toBe('iPhone · Safari')
        ->and(DeviceLabel::from(WINDOWS_EDGE))->toBe('Windows · Edge')
        ->and(DeviceLabel::from(null))->toBe('Dispositivo');
});

it('lists the own sessions newest first and flags the current one', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    // JSON test requests only send cookies with withCredentials(), and the API
    // only starts a session for a stateful (frontend) referer.
    $currentId = Str::random(40);
    sessionRow($user, $currentId, MAC_CHROME, '190.117.24.8', 0);
    sessionRow($user, 'phone', IPHONE_SAFARI, '190.117.24.9', 180);
    sessionRow($other, 'someone-else', WINDOWS_EDGE, '10.0.0.1', 5);

    $this->actingAs($user)->withCredentials()->withHeader('Referer', 'http://localhost:5174')->withCookie(config('session.cookie'), $currentId)->getJson('/api/me/sessions')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.device', 'Mac · Chrome')
        ->assertJsonPath('data.0.is_current', true)
        ->assertJsonPath('data.1.device', 'iPhone · Safari')
        ->assertJsonPath('data.1.ip_address', '190.117.24.9')
        ->assertJsonPath('data.1.is_current', false)
        ->assertJsonMissing(['id' => $currentId]);
});

it('closes every other session with the current password and keeps this one', function () {
    $user = User::factory()->create(['password' => 'safe-password']);
    $currentId = Str::random(40);
    sessionRow($user, $currentId, MAC_CHROME, '190.117.24.8', 0);
    sessionRow($user, 'phone', IPHONE_SAFARI, '190.117.24.9', 180);
    sessionRow($user, 'office', WINDOWS_EDGE, '190.117.24.10', 8640);
    $token = $user->getRememberToken();

    $this->actingAs($user)->withCredentials()->withHeader('Referer', 'http://localhost:5174')->withCookie(config('session.cookie'), $currentId)->deleteJson('/api/me/sessions/others', ['current_password' => 'wrong'])
        ->assertUnprocessable()->assertJsonValidationErrors(['current_password']);
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(3);

    $this->actingAs($user)->withCredentials()->withHeader('Referer', 'http://localhost:5174')->withCookie(config('session.cookie'), $currentId)->deleteJson('/api/me/sessions/others', ['current_password' => 'safe-password'])->assertNoContent();

    expect(DB::table('sessions')->where('user_id', $user->id)->pluck('id')->all())->toBe([$currentId])
        ->and($user->fresh()->getRememberToken())->not->toBe($token);
});
