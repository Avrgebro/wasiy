<?php

namespace App\Http\Controllers\Api;

use App\Actions\Staff\UpdateStaffAccountRole;
use App\Actions\Staff\UpdateStaffLocationAssignments;
use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStaffAccountRoleRequest;
use App\Http\Requests\UpdateStaffLocationAssignmentsRequest;
use App\Http\Resources\StaffResource;
use App\Models\Account;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AccountStaffController extends Controller
{
    public function index(Request $request, Account $account): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
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

        $staff = User::query()
            ->where(function (Builder $query) use ($account): void {
                $query
                    ->whereHas('accountUserRoles', fn (Builder $query) => $query->where('account_id', $account->id))
                    ->orWhereHas('locationUserRoles', fn (Builder $query) => $query->where('account_id', $account->id));
            })
            ->when($validated['search'] ?? null, function (Builder $query, string $search): void {
                $likeSearch = '%'.Str::lower(trim($search)).'%';

                $query->where(function (Builder $query) use ($likeSearch): void {
                    $query
                        ->whereRaw('LOWER(first_name) LIKE ?', [$likeSearch])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$likeSearch])
                        ->orWhereRaw("LOWER(first_name || ' ' || last_name) LIKE ?", [$likeSearch])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$likeSearch]);
                });
            })
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
            ->with([
                'accountUserRoles' => fn ($query) => $query->where('account_id', $account->id),
                'locationUserRoles' => fn ($query) => $query
                    ->where('account_id', $account->id)
                    ->with('location'),
            ])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->orderBy('email')
            ->paginate((int) ($validated['per_page'] ?? 15))
            ->withQueryString();

        return StaffResource::collection($staff);
    }

    public function updateRoles(
        UpdateStaffAccountRoleRequest $request,
        Account $account,
        User $user,
        UpdateStaffAccountRole $updateStaffAccountRole,
    ): JsonResource {
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
