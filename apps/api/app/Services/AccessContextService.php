<?php

namespace App\Services;

use App\Data\AccessContext;
use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\StaffMembership;
use App\Models\UnitMembership;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class AccessContextService
{
    private const ACTIVE_ACCOUNT_KEY = 'wasiy.active_account_id';

    private const ACTIVE_LOCATION_KEY = 'wasiy.active_location_id';

    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * Pure read of the app-shell context: never touches the session. Use
     * sync() on endpoints that should also repair stale or missing session
     * selections.
     */
    public function resolve(User $user, Request $request): AccessContext
    {
        return $this->buildContext($user, $request, persist: false);
    }

    /**
     * resolve() plus session repair: stale selections are forgotten and
     * auto-selections (single account, first location) are persisted so
     * follow-up requests see them. This is the app-shell bootstrap path.
     */
    public function sync(User $user, Request $request): AccessContext
    {
        return $this->buildContext($user, $request, persist: true);
    }

    private function buildContext(User $user, Request $request, bool $persist): AccessContext
    {
        $user->loadMissing([
            'staffMemberships.account',
            // Roles pointing at soft-deleted locations don't count.
            'staffMemberships.locationRoles' => fn ($query) => $query->whereHas('location'),
            'staffMemberships.locationRoles.location',
        ]);

        $accounts = $this->access->accessibleAccounts($user)
            ->withCount('locations')
            ->orderBy('name')
            ->get();
        $activeAccount = $this->resolveActiveAccount($request, $accounts, $persist);
        $membership = null;
        $locations = collect();
        $activeLocation = null;

        if ($activeAccount instanceof Account) {
            // accessibleAccounts() already excludes deactivated memberships,
            // so the active account's membership is active by construction.
            $membership = $user->staffMembershipForAccount($activeAccount);

            $locations = $this->access->accessibleLocationsForAccount($user, $activeAccount)
                ->orderBy('name')
                ->get();
            $activeLocation = $this->resolveActiveLocation($request, $locations, $persist);
        }

        $isAccountAdmin = $activeAccount instanceof Account
            && $this->access->hasAccountRole($user, $activeAccount, AccountRole::AccountAdmin);

        return new AccessContext(
            user: [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'name' => $user->name,
                'email' => $user->email,
            ],
            accounts: $accounts->map(fn (Account $account) => $this->accountSummary($account))->all(),
            activeAccount: $activeAccount instanceof Account
                ? $this->accountSummary($activeAccount)
                : null,
            activeLocation: $activeLocation instanceof Location
                ? $this->locationSummary($activeLocation, $membership, $isAccountAdmin)
                : null,
            roles: [
                'account' => $membership?->account_role !== null
                    ? [[
                        'account_id' => $membership->account_id,
                        'role' => $membership->account_role->value,
                    ]]
                    : [],
                'location' => $membership !== null
                    ? $membership->locationRoles->map(fn ($assignment) => [
                        'account_id' => $membership->account_id,
                        'location_id' => $assignment->location_id,
                        'role' => $assignment->role->value,
                    ])->values()->all()
                    : [],
            ],
            accessibleLocations: $locations
                ->map(fn (Location $location) => $this->locationSummary($location, $membership, $isAccountAdmin))
                ->all(),
            residentMemberships: $this->residentMemberships($user),
        );
    }

    public function selectAccount(User $user, Request $request, Account $account): AccessContext
    {
        $request->session()->put(self::ACTIVE_ACCOUNT_KEY, $account->id);
        $request->session()->forget(self::ACTIVE_LOCATION_KEY);

        return $this->sync($user, $request);
    }

    public function selectLocation(User $user, Request $request, Location $location): AccessContext
    {
        $request->session()->put(self::ACTIVE_LOCATION_KEY, $location->id);

        return $this->sync($user, $request);
    }

    public function clear(Request $request, User $user): AccessContext
    {
        $this->forget($request);

        return $this->sync($user, $request);
    }

    /**
     * The session's active Account, verified to still exist and be
     * accessible; forgets the stale selection and 409s otherwise. Owns the
     * invariant so controllers don't re-derive it from primitives.
     */
    public function activeAccountOrFail(Request $request, User $user): Account
    {
        $activeAccountId = $this->activeAccountId($request);
        $account = $activeAccountId ? Account::query()->find($activeAccountId) : null;

        if (! $account instanceof Account || ! $this->access->canAccessAccount($user, $account)) {
            $this->forget($request);
            abort(409, 'Select an active Account before selecting a Location.');
        }

        return $account;
    }

    public function forget(Request $request): void
    {
        $request->session()->forget([
            self::ACTIVE_ACCOUNT_KEY,
            self::ACTIVE_LOCATION_KEY,
        ]);
    }

    public function hasActiveAccount(Request $request): bool
    {
        return $request->session()->has(self::ACTIVE_ACCOUNT_KEY);
    }

    public function activeAccountId(Request $request): ?string
    {
        $accountId = $request->session()->get(self::ACTIVE_ACCOUNT_KEY);

        return is_string($accountId) ? $accountId : null;
    }

    /**
     * @param  Collection<int, Account>  $accounts
     */
    private function resolveActiveAccount(Request $request, Collection $accounts, bool $persist): ?Account
    {
        $activeAccountId = $this->activeAccountId($request);
        $activeAccount = $activeAccountId
            ? $accounts->firstWhere('id', $activeAccountId)
            : null;

        if ($persist && $activeAccountId && ! $activeAccount instanceof Account) {
            $request->session()->forget([
                self::ACTIVE_ACCOUNT_KEY,
                self::ACTIVE_LOCATION_KEY,
            ]);
        }

        if (! $activeAccount instanceof Account && $accounts->count() === 1) {
            $activeAccount = $accounts->first();

            if ($persist) {
                $request->session()->put(self::ACTIVE_ACCOUNT_KEY, $activeAccount->id);
            }
        }

        return $activeAccount instanceof Account ? $activeAccount : null;
    }

    /**
     * @param  Collection<int, Location>  $locations
     */
    private function resolveActiveLocation(Request $request, Collection $locations, bool $persist): ?Location
    {
        $activeLocationId = $request->session()->get(self::ACTIVE_LOCATION_KEY);
        $activeLocation = is_string($activeLocationId)
            ? $locations->firstWhere('id', $activeLocationId)
            : null;

        if ($persist && $activeLocationId && ! $activeLocation instanceof Location) {
            $request->session()->forget(self::ACTIVE_LOCATION_KEY);
        }

        // Select a Location whenever any is accessible, not only when there is
        // exactly one. The location-scoped surface is unusable without an
        // active Location, and locations are ordered by name so the fallback is
        // deterministic. An Account with no Locations yet resolves to null,
        // which is the signal for an admin to go create one.
        if (! $activeLocation instanceof Location && $locations->isNotEmpty()) {
            $activeLocation = $locations->first();

            if ($persist) {
                $request->session()->put(self::ACTIVE_LOCATION_KEY, $activeLocation->id);
            }
        }

        return $activeLocation instanceof Location ? $activeLocation : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function accountSummary(Account $account): array
    {
        return [
            'id' => $account->id,
            'name' => $account->name,
            'slug' => $account->slug,
            'timezone' => $account->timezone,
            // Loaded via withCount() in buildContext; the fallback covers
            // Account instances that arrive without it.
            'locations_count' => (int) ($account->locations_count ?? $account->locations()->count()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function locationSummary(Location $location, ?StaffMembership $membership, bool $isAccountAdmin): array
    {
        $roles = [];

        if ($isAccountAdmin) {
            $roles[] = AccountRole::AccountAdmin->value;
        }

        $locationRole = $membership?->locationRoles
            ->firstWhere('location_id', $location->id);

        if ($locationRole) {
            $roles[] = $locationRole->role->value;
        }

        $accessSource = match (true) {
            $isAccountAdmin && $locationRole !== null => 'both',
            $isAccountAdmin => 'account_role',
            default => 'location_role',
        };

        return [
            'id' => $location->id,
            'account_id' => $location->account_id,
            'name' => $location->name,
            'slug' => $location->slug,
            'timezone' => $location->timezone,
            'address' => $location->address,
            'roles' => array_values(array_unique($roles)),
            'access_source' => $accessSource,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function residentMemberships(User $user): array
    {
        return $this->access->activeResidentMembershipsForUser($user)
            ->with(['unit', 'location'])
            ->orderBy('location_id')
            ->orderBy('unit_id')
            ->get()
            ->map(fn (UnitMembership $membership): array => [
                'resident_id' => $membership->resident_id,
                'unit_membership_id' => $membership->id,
                'account_id' => $membership->account_id,
                'location_id' => $membership->location_id,
                'unit_id' => $membership->unit_id,
                'unit_label' => $membership->unit->label(),
                'resident_type' => $membership->resident_type->value,
                'is_primary_contact' => $membership->is_primary_contact,
            ])
            ->values()
            ->all();
    }
}
