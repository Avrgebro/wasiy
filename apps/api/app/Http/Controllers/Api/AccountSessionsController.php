<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\DeviceLabel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Where the account is open right now (mockup 21, "Sesiones activas"). Reads
 * the database session store, so it lists exactly what can be revoked, and
 * revoking deletes those rows: the other browser's next request finds no
 * session and lands on login.
 */
class AccountSessionsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $currentId = $request->session()->getId();

        $sessions = DB::table('sessions')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(fn ($row) => [
                // The id is a bearer credential; a hash is enough to tell rows apart.
                'id' => hash('sha256', (string) $row->id),
                'device' => DeviceLabel::from($row->user_agent),
                'ip_address' => $row->ip_address,
                'last_active_at' => Carbon::createFromTimestamp((int) $row->last_activity)->toIso8601String(),
                'is_current' => $row->id === $currentId,
            ])
            ->values();

        return response()->json(['data' => $sessions]);
    }

    /** Everything but this browser; the password confirms it is the owner asking. */
    public function destroyOthers(Request $request): Response
    {
        $request->validate(['current_password' => ['required', 'current_password']]);
        $user = $request->user();

        DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        // Other devices' remember-me cookies would log them straight back in.
        $user->setRememberToken(Str::random(60));
        $user->save();

        return response()->noContent();
    }
}
