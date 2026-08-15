<?php

namespace App\Http\Controllers\Api;

use App\Actions\Staff\UpdateStaffAccountRole;
use App\Actions\Staff\UpdateStaffLocationAssignments;
use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStaffAccountRoleRequest;
use App\Http\Requests\UpdateStaffLocationAssignmentsRequest;
use App\Http\Resources\StaffResource;
use App\Models\Account;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\AccessAuthorizationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AccountStaffController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function index(Request $request, Account $account): AnonymousResourceCollection
    {
        $validated = $request->validate([
            ...$this->paginationRules(),
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role' => [
                'sometimes',
                'nullable',
                Rule::in([
                    AccountRole::AccountAdmin->value,
                    LocationRole::LocationManager->value,
                    LocationRole::FrontDesk->value,
                ]),
            ],
            'location_id' => [
                'sometimes',
                'nullable',
                'string',
                'ulid',
                Rule::exists('locations', 'id')
                    ->where('account_id', $account->id)
                    ->whereNull('deleted_at'),
            ],
        ]);

        $staff = $this->access->staffForAccount($account)
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->searchLike(
                ['first_name', 'last_name', "first_name || ' ' || last_name", 'email'],
                $search,
            ))
            ->when($validated['role'] ?? null, function (Builder $query, string $role) use ($account): void {
                if ($role === AccountRole::AccountAdmin->value) {
                    $query->whereHas('accountUserRoles', fn (Builder $query) => $query
                        ->where('account_id', $account->id)
                        ->where('role', $role));

                    return;
                }

                $query->whereHas('locationUserRoles', fn (Builder $query) => $query
                    ->where('account_id', $account->id)
                    ->where('role', $role));
            })
            ->when($validated['location_id'] ?? null, fn (Builder $query, string $locationId) => $query
                ->whereHas('locationUserRoles', fn (Builder $query) => $query
                    ->where('account_id', $account->id)
                    ->where('location_id', $locationId)))
            ->with(User::staffRelationsForAccount($account))
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->orderBy('email')
            ->paginate($this->perPage($validated))
            ->withQueryString();

        return StaffResource::collection($staff)
            ->additional(['pending_invitations' => $this->pendingInvitations($account)]);
    }

    /**
     * People who have been invited but hold no roles yet, so they cannot appear
     * in the staff list itself. Returned whole and unfiltered: this is a small
     * bounded set rendered as its own section, not part of the filtered table.
     *
     * @return array<int, array<string, mixed>>
     */
    private function pendingInvitations(Account $account): array
    {
        return UserInvitation::query()
            ->where('account_id', $account->id)
            ->where('purpose', UserInvitationPurpose::Staff->value)
            ->where('status', UserInvitationStatus::Pending->value)
            ->with('invitedBy')
            ->orderBy('created_at')
            ->get()
            ->map(fn (UserInvitation $invitation): array => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'first_name' => $invitation->first_name,
                'last_name' => $invitation->last_name,
                'expires_at' => $invitation->expires_at?->toJSON(),
                'invited_by' => ['name' => $invitation->invitedBy?->name],
                'invited_account_role' => $invitation->invitedAccountRole(),
                'invited_location_assignments' => $invitation->invitedLocationAssignments(),
            ])
            ->all();
    }

    public function updateRoles(
        UpdateStaffAccountRoleRequest $request,
        Account $account,
        User $user,
        UpdateStaffAccountRole $updateStaffAccountRole,
    ): JsonResource {
        abort_unless($this->access->isStaffForAccount($user, $account), 404);

        /** @var User $actor */
        $actor = $request->user();

        return new StaffResource($updateStaffAccountRole->handle(
            $account,
            $actor,
            $user,
            $request->validated('account_role'),
        ));
    }

    public function updateLocations(
        UpdateStaffLocationAssignmentsRequest $request,
        Account $account,
        User $user,
        UpdateStaffLocationAssignments $updateStaffLocationAssignments,
    ): JsonResource {
        abort_unless($this->access->isStaffForAccount($user, $account), 404);

        /** @var User $actor */
        $actor = $request->user();

        return new StaffResource($updateStaffLocationAssignments->handle(
            $account,
            $actor,
            $user,
            $request->validated('location_assignments'),
        ));
    }
}
