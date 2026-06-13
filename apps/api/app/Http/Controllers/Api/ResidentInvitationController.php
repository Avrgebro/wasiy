<?php

namespace App\Http\Controllers\Api;

use App\Actions\Residents\ClaimResidentInvitation;
use App\Actions\Residents\InviteResidentUser;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ResidentInvitationResource;
use App\Http\Resources\ResidentResource;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class ResidentInvitationController extends Controller
{
    public function store(
        Request $request,
        Resident $resident,
        InviteResidentUser $inviteResidentUser,
    ): JsonResponse {
        $validated = $request->validate([
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
        ]);

        /** @var User $actor */
        $actor = $request->user();

        $result = $inviteResidentUser->handle($resident, $actor, $validated);

        return response()->json([
            'data' => [
                'resident' => (new ResidentResource($result['resident']))->toArray($request),
                'invitation' => (new ResidentInvitationResource($result['invitation']))->toArray($request),
            ],
        ], 201);
    }

    public function show(Request $request, string $token): JsonResponse
    {
        $invitation = $this->validPendingInvitationForToken($token);

        return response()->json([
            'data' => [
                ...(new ResidentInvitationResource($invitation))->toArray($request),
                'resident' => [
                    'id' => $invitation->resident->id,
                    'name' => $invitation->resident->name,
                    'status' => $invitation->resident->status->value,
                ],
                'account' => [
                    'id' => $invitation->account->id,
                    'name' => $invitation->account->name,
                ],
            ],
        ]);
    }

    public function claim(
        Request $request,
        string $token,
        ClaimResidentInvitation $claimResidentInvitation,
    ): JsonResponse {
        $validated = $request->validate([
            'password' => ['required', 'string', Password::default(), 'confirmed'],
        ]);

        $invitation = $this->validPendingInvitationForToken($token);
        $invitation = $claimResidentInvitation->handle($invitation, $validated['password']);

        return response()->json([
            'data' => [
                'resident' => (new ResidentResource($invitation->resident->loadSummary()))->toArray($request),
                'invitation' => (new ResidentInvitationResource($invitation))->toArray($request),
            ],
        ]);
    }

    private function validPendingInvitationForToken(string $token): UserInvitation
    {
        $invitation = UserInvitation::query()
            ->with(['account', 'resident'])
            ->where('token_hash', hash('sha256', $token))
            ->where('purpose', UserInvitationPurpose::Resident->value)
            ->first();

        if (! $invitation || $invitation->status !== UserInvitationStatus::Pending) {
            abort(410);
        }

        if ($invitation->expires_at->isPast()) {
            $invitation->forceFill(['status' => UserInvitationStatus::Expired])->save();
            abort(410);
        }

        return $invitation;
    }
}
