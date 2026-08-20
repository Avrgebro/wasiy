<?php

namespace App\Http\Controllers\Api;

use App\Actions\Staff\DeactivateStaffMembership;
use App\Actions\Staff\ReactivateStaffMembership;
use App\Actions\Staff\UpdateStaffAccess;
use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStaffAccessRequest;
use App\Http\Resources\StaffResource;
use App\Models\Account;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
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
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'deactivated'])],
        ]);

        $staff = $this->access->staffForAccount($account)
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->searchLike(
                ['first_name', 'last_name', "first_name || ' ' || last_name", 'email'],
                $search,
            ))
            ->when($validated['role'] ?? null, function (Builder $query, string $role) use ($account): void {
                if ($role === AccountRole::AccountAdmin->value) {
                    $query->whereHas('staffMemberships', fn (Builder $query) => $query
                        ->where('account_id', $account->id)
                        ->where('account_role', $role));

                    return;
                }

                $query->whereHas('staffMemberships.locationRoles', fn (Builder $query) => $query
                    ->where('account_id', $account->id)
                    ->where('role', $role));
            })
            ->when($validated['location_id'] ?? null, fn (Builder $query, string $locationId) => $query
                ->whereHas('staffMemberships.locationRoles', fn (Builder $query) => $query
                    ->where('account_id', $account->id)
                    ->where('location_id', $locationId)))
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query
                ->whereHas('staffMemberships', fn (Builder $query) => $query
                    ->where('account_id', $account->id)
                    ->when(
                        $status === 'active',
                        fn (Builder $query) => $query->whereNull('deactivated_at'),
                        fn (Builder $query) => $query->whereNotNull('deactivated_at'),
                    )))
            ->with(User::staffRelationsForAccount($account))
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->orderBy('email')
            ->paginate($this->perPage($validated))
            ->withQueryString();

        return StaffResource::collection($staff);
    }

    public function updateAccess(
        UpdateStaffAccessRequest $request,
        Account $account,
        User $user,
        UpdateStaffAccess $updateStaffAccess,
    ): JsonResource {
        abort_unless($this->access->isStaffForAccount($user, $account), 404);

        /** @var User $actor */
        $actor = $request->user();

        return new StaffResource($updateStaffAccess->handle(
            $account,
            $actor,
            $user,
            $request->validated('account_role'),
            $request->validated('location_assignments'),
        ));
    }

    public function deactivate(
        Request $request,
        Account $account,
        User $user,
        DeactivateStaffMembership $deactivateStaffMembership,
    ): JsonResource {
        abort_unless($this->access->isStaffForAccount($user, $account), 404);

        /** @var User $actor */
        $actor = $request->user();

        return new StaffResource($deactivateStaffMembership->handle($account, $actor, $user));
    }

    public function reactivate(
        Request $request,
        Account $account,
        User $user,
        ReactivateStaffMembership $reactivateStaffMembership,
    ): JsonResource {
        abort_unless($this->access->isStaffForAccount($user, $account), 404);

        /** @var User $actor */
        $actor = $request->user();

        return new StaffResource($reactivateStaffMembership->handle($account, $actor, $user));
    }
}
