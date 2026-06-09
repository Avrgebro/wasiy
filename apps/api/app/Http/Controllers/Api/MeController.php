<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->load([
            'accountUserRoles.account',
            'locationUserRoles.account',
            'locationUserRoles.location',
        ]);

        $accounts = $user->accountUserRoles
            ->pluck('account')
            ->merge($user->locationUserRoles->pluck('account'))
            ->filter()
            ->unique('id')
            ->values();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'accounts' => $accounts->map(fn (Account $account) => [
                'id' => $account->id,
                'name' => $account->name,
                'slug' => $account->slug,
                'timezone' => $account->timezone,
            ])->all(),
            'active_account' => null,
            'roles' => [
                'account' => $user->accountUserRoles->map(fn ($assignment) => [
                    'account_id' => $assignment->account_id,
                    'role' => $assignment->role->value,
                ])->values()->all(),
                'location' => $user->locationUserRoles->map(fn ($assignment) => [
                    'account_id' => $assignment->account_id,
                    'location_id' => $assignment->location_id,
                    'role' => $assignment->role->value,
                ])->values()->all(),
            ],
            'assigned_locations' => $user->locationUserRoles->map(fn ($assignment) => [
                'id' => $assignment->location->id,
                'account_id' => $assignment->account_id,
                'name' => $assignment->location->name,
                'slug' => $assignment->location->slug,
                'timezone' => $assignment->location->timezone,
                'role' => $assignment->role->value,
            ])->values()->all(),
            'resident_memberships' => [],
        ]);
    }
}
