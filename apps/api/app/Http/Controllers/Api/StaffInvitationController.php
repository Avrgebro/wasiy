<?php

namespace App\Http\Controllers\Api;

use App\Actions\Invitations\CancelUserInvitation;
use App\Actions\Invitations\ResendUserInvitation;
use App\Actions\Staff\AcceptStaffInvitation;
use App\Actions\Staff\InviteStaffUser;
use App\Data\AccessContext;
use App\Enums\UserInvitationPurpose;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStaffInvitationRequest;
use App\Http\Resources\StaffInvitationResource;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\AccessContextService;
use App\Services\UserInvitationTokenResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;

class StaffInvitationController extends Controller
{
    public function __construct(
        private readonly UserInvitationTokenResolver $tokenResolver,
        private readonly AccessContextService $accessContext,
    ) {}

    public function store(
        StoreStaffInvitationRequest $request,
        Account $account,
        InviteStaffUser $inviteStaffUser,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        $invitation = $inviteStaffUser->handle($account, $actor, $request->validated());

        return response()->json([
            'data' => [
                'invitation' => (new StaffInvitationResource($invitation))->toArray($request),
            ],
        ], 201);
    }

    public function destroy(
        Request $request,
        Account $account,
        UserInvitation $invitation,
        CancelUserInvitation $cancelUserInvitation,
    ): JsonResponse {
        $this->authorizeAccountInvitation($account, $invitation);

        /** @var User $actor */
        $actor = $request->user();

        return response()->json([
            'data' => [
                'invitation' => (new StaffInvitationResource(
                    $cancelUserInvitation->handle($invitation, $actor),
                ))->toArray($request),
            ],
        ]);
    }

    public function resend(
        Request $request,
        Account $account,
        UserInvitation $invitation,
        ResendUserInvitation $resendUserInvitation,
    ): JsonResponse {
        $this->authorizeAccountInvitation($account, $invitation);

        /** @var User $actor */
        $actor = $request->user();

        return response()->json([
            'data' => [
                'invitation' => (new StaffInvitationResource(
                    $resendUserInvitation->handle($invitation, $actor),
                ))->toArray($request),
            ],
        ]);
    }

    /**
     * Route model binding resolves invitations globally, so an invitation from
     * another Account must 404 rather than leak its existence.
     */
    private function authorizeAccountInvitation(Account $account, UserInvitation $invitation): void
    {
        abort_unless(
            $invitation->account_id === $account->id
                && $invitation->purpose === UserInvitationPurpose::Staff,
            404,
        );
    }

    public function show(Request $request, string $token): JsonResponse
    {
        $invitation = $this->tokenResolver->resolve(
            $token,
            UserInvitationPurpose::Staff,
            ['account', 'invitedBy'],
        );

        return response()->json([
            'data' => [
                'email' => $invitation->email,
                'first_name' => $invitation->first_name,
                'last_name' => $invitation->last_name,
                'expires_at' => $invitation->expires_at?->toJSON(),
                // Tells the SPA whether to collect a password or ask an
                // existing user to confirm joining.
                'requires_account_creation' => ! $this->userExistsFor($invitation),
                'account' => [
                    'id' => $invitation->account->id,
                    'name' => $invitation->account->name,
                ],
                'invited_by' => [
                    'name' => $invitation->invitedBy?->name,
                ],
                'roles' => $this->roleSummary($invitation),
            ],
        ]);
    }

    public function accept(
        Request $request,
        string $token,
        AcceptStaffInvitation $acceptStaffInvitation,
    ): JsonResponse {
        $invitation = $this->tokenResolver->resolve(
            $token,
            UserInvitationPurpose::Staff,
            ['account'],
        );

        $validated = $this->userExistsFor($invitation)
            ? []
            : $request->validate([
                'first_name' => ['sometimes', 'required', 'string', 'max:255'],
                'last_name' => ['sometimes', 'required', 'string', 'max:255'],
                'password' => ['required', 'string', Password::default(), 'confirmed'],
            ]);

        $result = $acceptStaffInvitation->handle($invitation, $request->user(), $validated);

        return response()->json([
            'data' => [
                'skipped_location_ids' => $result['skipped_location_ids'],
                'session' => $this->authenticateAcceptedUser($request, $result['user']),
            ],
        ]);
    }

    private function userExistsFor(UserInvitation $invitation): bool
    {
        return User::query()->where('email', $invitation->email)->exists();
    }

    /**
     * A summary safe to render for an unauthenticated visitor holding the
     * token. The stored payload is never echoed back verbatim.
     *
     * @return array<string, mixed>
     */
    private function roleSummary(UserInvitation $invitation): array
    {
        $assignments = $invitation->invitedLocationAssignments();

        $locationNames = Location::query()
            ->where('account_id', $invitation->account_id)
            ->whereIn('id', collect($assignments)->pluck('location_id'))
            ->pluck('name', 'id');

        return [
            'account_role' => $invitation->invitedAccountRole(),
            'locations' => collect($assignments)
                ->map(fn (array $assignment): ?array => $locationNames->has($assignment['location_id'])
                    ? [
                        'name' => $locationNames->get($assignment['location_id']),
                        'role' => $assignment['role'],
                    ]
                    : null)
                ->filter()
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function authenticateAcceptedUser(Request $request, User $user): ?AccessContext
    {
        if (! $request->hasSession()) {
            return null;
        }

        if ($request->user()?->id !== $user->id) {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();
        }

        return $this->accessContext->sync($user, $request);
    }
}
