<?php

namespace App\Services;

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\Location;
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
     * @return array<string, mixed>
     */
    public function resolve(User $user, Request $request): array
    {
        $user->loadMissing([
            'accountUserRoles.account',
            'locationUserRoles.account',
            'locationUserRoles.location',
        ]);

        $accounts = $this->access->accessibleAccounts($user)
            ->orderBy('name')
            ->get();
        $activeAccount = $this->resolveActiveAccount($request, $accounts);
        $accountRoles = collect();
        $locationRoles = collect();
        $locations = collect();
        $activeLocation = null;

        if ($activeAccount instanceof Account) {
            $accountRoles = $user->accountUserRoles
                ->where('account_id', $activeAccount->id)
                ->values();

            $locationRoles = $user->locationUserRoles
                ->where('account_id', $activeAccount->id)
                ->values();

            $locations = $this->access->accessibleLocationsForAccount($user, $activeAccount)
                ->orderBy('name')
                ->get();
            $activeLocation = $this->resolveActiveLocation($request, $locations);
        }

        $isAccountAdmin = $activeAccount instanceof Account
            && $this->access->hasAccountRole($user, $activeAccount, AccountRole::AccountAdmin);

        return [
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'accounts' => $accounts->map(fn (Account $account) => $this->accountSummary($account))->all(),
            'active_account' => $activeAccount instanceof Account
                ? $this->accountSummary($activeAccount)
                : null,
            'active_location' => $activeLocation instanceof Location
                ? $this->locationSummary($activeLocation, $user, $isAccountAdmin)
                : null,
            'roles' => [
                'account' => $accountRoles->map(fn ($assignment) => [
                    'account_id' => $assignment->account_id,
                    'role' => $assignment->role->value,
                ])->all(),
                'location' => $locationRoles->map(fn ($assignment) => [
                    'account_id' => $assignment->account_id,
                    'location_id' => $assignment->location_id,
                    'role' => $assignment->role->value,
                ])->all(),
            ],
            'accessible_locations' => $locations
                ->map(fn (Location $location) => $this->locationSummary($location, $user, $isAccountAdmin))
                ->all(),
            'resident_memberships' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function selectAccount(User $user, Request $request, Account $account): array
    {
        $request->session()->put(self::ACTIVE_ACCOUNT_KEY, $account->id);
        $request->session()->forget(self::ACTIVE_LOCATION_KEY);

        $locations = $this->access->accessibleLocationsForAccount($user, $account)
            ->orderBy('name')
            ->get();

        if ($locations->count() === 1) {
            $request->session()->put(self::ACTIVE_LOCATION_KEY, $locations->first()->id);
        }

        return $this->resolve($user, $request);
    }

    /**
     * @return array<string, mixed>
     */
    public function selectLocation(User $user, Request $request, Location $location): array
    {
        $request->session()->put(self::ACTIVE_LOCATION_KEY, $location->id);

        return $this->resolve($user, $request);
    }

    /**
     * @return array<string, mixed>
     */
    public function clear(Request $request, User $user): array
    {
        $this->forget($request);

        return $this->resolve($user, $request);
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
    private function resolveActiveAccount(Request $request, Collection $accounts): ?Account
    {
        $activeAccountId = $this->activeAccountId($request);
        $activeAccount = $activeAccountId
            ? $accounts->firstWhere('id', $activeAccountId)
            : null;

        if ($activeAccountId && ! $activeAccount instanceof Account) {
            $request->session()->forget([
                self::ACTIVE_ACCOUNT_KEY,
                self::ACTIVE_LOCATION_KEY,
            ]);
        }

        if (! $activeAccount instanceof Account && $accounts->count() === 1) {
            $activeAccount = $accounts->first();
            $request->session()->put(self::ACTIVE_ACCOUNT_KEY, $activeAccount->id);
        }

        return $activeAccount instanceof Account ? $activeAccount : null;
    }

    /**
     * @param  Collection<int, Location>  $locations
     */
    private function resolveActiveLocation(Request $request, Collection $locations): ?Location
    {
        $activeLocationId = $request->session()->get(self::ACTIVE_LOCATION_KEY);
        $activeLocation = is_string($activeLocationId)
            ? $locations->firstWhere('id', $activeLocationId)
            : null;

        if ($activeLocationId && ! $activeLocation instanceof Location) {
            $request->session()->forget(self::ACTIVE_LOCATION_KEY);
        }

        if (! $activeLocation instanceof Location && $locations->count() === 1) {
            $activeLocation = $locations->first();
            $request->session()->put(self::ACTIVE_LOCATION_KEY, $activeLocation->id);
        }

        return $activeLocation instanceof Location ? $activeLocation : null;
    }

    /**
     * @return array<string, string>
     */
    private function accountSummary(Account $account): array
    {
        return [
            'id' => $account->id,
            'name' => $account->name,
            'slug' => $account->slug,
            'timezone' => $account->timezone,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function locationSummary(Location $location, User $user, bool $isAccountAdmin): array
    {
        $roles = [];
        $accessSource = 'location_role';

        if ($isAccountAdmin) {
            $roles[] = AccountRole::AccountAdmin->value;
            $accessSource = 'account_role';
        }

        $locationRole = $user->locationUserRoles
            ->firstWhere('location_id', $location->id);

        if ($locationRole) {
            $roles[] = $locationRole->role->value;
        }

        return [
            'id' => $location->id,
            'account_id' => $location->account_id,
            'name' => $location->name,
            'slug' => $location->slug,
            'timezone' => $location->timezone,
            'roles' => array_values(array_unique($roles)),
            'access_source' => $accessSource,
        ];
    }
}
