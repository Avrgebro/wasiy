<?php

namespace App\Http\Controllers\Api;

use App\Actions\Staff\InviteStaffUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStaffInvitationRequest;
use App\Http\Resources\StaffInvitationResource;
use App\Http\Resources\StaffResource;
use App\Models\Account;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class StaffInvitationController extends Controller
{
    public function store(
        StoreStaffInvitationRequest $request,
        Account $account,
        InviteStaffUser $inviteStaffUser,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        $result = $inviteStaffUser->handle($account, $actor, $request->validated());

        return response()->json([
            'data' => [
                'staff' => (new StaffResource($result['staff']))->toArray($request),
                'invitation' => (new StaffInvitationResource($result['invitation']))->toArray($request),
            ],
        ], 201);
    }
}
