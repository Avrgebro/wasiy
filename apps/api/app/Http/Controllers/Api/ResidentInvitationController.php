<?php

namespace App\Http\Controllers\Api;

use App\Actions\Invitations\CancelUserInvitation;
use App\Actions\Invitations\ResendUserInvitation;
use App\Actions\Residents\ClaimResidentInvitation;
use App\Actions\Residents\InviteResidentUser;
use App\Data\AccessContext;
use App\Enums\UserInvitationPurpose;
use App\Http\Controllers\Controller;
use App\Http\Resources\ResidentInvitationResource;
use App\Http\Resources\ResidentResource;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\AccessAuthorizationService;
use App\Services\AccessContextService;
use App\Services\UserInvitationTokenResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;

class ResidentInvitationController extends Controller
{
    public function __construct(
        private readonly UserInvitationTokenResolver $tokenResolver,
        private readonly AccessContextService $accessContext,
        private readonly AccessAuthorizationService $access,
    ) {}

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

        return $this->dataResponse([
            'resident' => (new ResidentResource($result['resident']))->toArray($request),
            'invitation' => (new ResidentInvitationResource($result['invitation']))->toArray($request),
        ], 201);
    }

    public function destroy(
        Request $request,
        Resident $resident,
        UserInvitation $invitation,
        CancelUserInvitation $cancelUserInvitation,
    ): JsonResponse {
        $actor = $this->authorizeResidentInvitation($request, $resident, $invitation);

        return $this->dataResponse([
            'invitation' => (new ResidentInvitationResource(
                $cancelUserInvitation->handle($invitation, $actor),
            ))->toArray($request),
        ]);
    }

    public function resend(
        Request $request,
        Resident $resident,
        UserInvitation $invitation,
        ResendUserInvitation $resendUserInvitation,
    ): JsonResponse {
        $actor = $this->authorizeResidentInvitation($request, $resident, $invitation);

        return $this->dataResponse([
            'invitation' => (new ResidentInvitationResource(
                $resendUserInvitation->handle($invitation, $actor),
            ))->toArray($request),
        ]);
    }

    /**
     * Same authority as issuing the invitation in the first place. The 404
     * comes first so an invitation belonging to another Resident is not
     * distinguishable from one that does not exist.
     */
    private function authorizeResidentInvitation(
        Request $request,
        Resident $resident,
        UserInvitation $invitation,
    ): User {
        abort_unless(
            $invitation->resident_id === $resident->id
                && $invitation->purpose === UserInvitationPurpose::Resident,
            404,
        );

        /** @var User $actor */
        $actor = $request->user();

        abort_unless(
            $this->access->manageableInvitationLocationForResident($actor, $resident) !== null,
            403,
        );

        return $actor;
    }

    public function show(Request $request, string $token): JsonResponse
    {
        $invitation = $this->tokenResolver->resolve(
            $token,
            UserInvitationPurpose::Resident,
            ['account', 'resident'],
        );

        return $this->dataResponse([
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

        $invitation = $this->tokenResolver->resolve(
            $token,
            UserInvitationPurpose::Resident,
            ['account', 'resident'],
        );
        $invitation = $claimResidentInvitation->handle($invitation, $validated['password']);

        return $this->dataResponse([
            'resident' => (new ResidentResource($invitation->resident->loadSummary()))->toArray($request),
            'invitation' => (new ResidentInvitationResource($invitation))->toArray($request),
            'session' => $this->authenticateClaimedUser($request, $invitation),
        ]);
    }

    /**
     * Sign the resident in as part of the claim, so activating an account does
     * not dead-end at a login form. Returns the same payload as /api/me for the
     * SPA to seed its session cache with.
     *
     * @return array<string, mixed>|null
     */
    private function authenticateClaimedUser(Request $request, UserInvitation $invitation): ?AccessContext
    {
        $user = $invitation->user;

        if (! $user instanceof User || ! $request->hasSession()) {
            return null;
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return $this->accessContext->sync($user, $request);
    }
}
