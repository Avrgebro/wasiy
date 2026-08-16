<?php

namespace App\Services;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;

class AccessAuthorizationService
{
    /**
     * @return Builder<Account>
     */
    public function accessibleAccounts(User $user): Builder
    {
        return Account::query()
            ->where(function (Builder $query) use ($user): void {
                $query
                    ->whereIn('id', AccountUserRole::query()
                        ->select('account_id')
                        ->where('user_id', $user->id))
                    ->orWhereIn('id', LocationUserRole::query()
                        ->select('account_id')
                        ->where('user_id', $user->id)
                        ->whereHas('location'));
            });
    }

    public function hasAccountRole(User $user, Account $account, AccountRole $role): bool
    {
        if ($account->trashed()) {
            return false;
        }

        return AccountUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $user->id)
            ->where('role', $role->value)
            ->exists();
    }

    public function hasLocationRole(User $user, Location $location, LocationRole $role): bool
    {
        if (! $this->isLiveLocation($location)) {
            return false;
        }

        return LocationUserRole::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->where('user_id', $user->id)
            ->where('role', $role->value)
            ->exists();
    }

    public function canAccessAccount(User $user, Account $account): bool
    {
        // accessibleAccounts() is the single encoding of the membership
        // rule; the default soft-delete scope excludes trashed accounts.
        return $this->accessibleAccounts($user)->whereKey($account->id)->exists();
    }

    public function canAccessLocation(User $user, Location $location): bool
    {
        if (! $this->isLiveLocation($location)) {
            return false;
        }

        return AccountUserRole::query()
            ->where('account_id', $location->account_id)
            ->where('user_id', $user->id)
            ->where('role', AccountRole::AccountAdmin->value)
            ->exists()
            || LocationUserRole::query()
                ->where('account_id', $location->account_id)
                ->where('location_id', $location->id)
                ->where('user_id', $user->id)
                ->exists();
    }

    public function canManageStaff(User $user, Account $account): bool
    {
        return $this->hasAccountRole($user, $account, AccountRole::AccountAdmin);
    }

    public function canManageRegistry(User $user, Location $location): bool
    {
        if (! $this->isLiveLocation($location)) {
            return false;
        }

        return $this->hasAccountRole($user, $location->account, AccountRole::AccountAdmin)
            || $this->hasLocationRole($user, $location, LocationRole::LocationManager);
    }

    public function canViewRegistry(User $user, Location $location): bool
    {
        return $this->canManageRegistry($user, $location)
            || $this->hasLocationRole($user, $location, LocationRole::FrontDesk);
    }

    public function canManageUnit(User $user, Unit $unit): bool
    {
        if (! $this->registryRecordLocationMatches($unit->location, $unit->account_id)) {
            return false;
        }

        return $this->canManageRegistry($user, $unit->location);
    }

    public function canManageResidentInLocation(User $user, Resident $resident, Location $location): bool
    {
        if ($resident->account_id !== $location->account_id || ! $this->canManageRegistry($user, $location)) {
            return false;
        }

        if ($this->hasAccountRole($user, $location->account, AccountRole::AccountAdmin)) {
            return true;
        }

        return $resident->unitMemberships()
            ->where('location_id', $location->id)
            ->where('account_id', $location->account_id)
            ->exists();
    }

    /**
     * The Location an invitation for this Resident should be scoped to, or null
     * when the actor may not manage the Resident's portal access at all.
     *
     * Prefers a Location the actor can manage the Resident in; Account Admins
     * fall back to any Location the Resident has a membership in.
     */
    public function manageableInvitationLocationForResident(User $user, Resident $resident): ?Location
    {
        $memberships = $resident->unitMemberships()
            ->whereHas('location')
            ->where('account_id', $resident->account_id)
            ->with('location');

        // Admin fast-path: one role check instead of a per-location query
        // fan-out. Prefer an active membership's location, then any.
        if ($this->hasAccountRole($user, $resident->account, AccountRole::AccountAdmin)) {
            $active = (clone $memberships)->where('status', RegistryStatus::Active)->first()?->location;

            return $active ?? $memberships->first()?->location;
        }

        return $memberships
            ->where('status', RegistryStatus::Active)
            ->whereIn('location_id', LocationUserRole::query()
                ->select('location_id')
                ->where('account_id', $resident->account_id)
                ->where('user_id', $user->id)
                ->where('role', LocationRole::LocationManager->value))
            ->first()
            ?->location;
    }

    /**
     * Whether the user can manage the registry in at least one of the
     * account's locations. One query instead of a per-location fan-out.
     */
    public function canManageAnyRegistryInAccount(User $user, Account $account): bool
    {
        if ($this->hasAccountRole($user, $account, AccountRole::AccountAdmin)) {
            return true;
        }

        return LocationUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $user->id)
            ->where('role', LocationRole::LocationManager->value)
            ->whereHas('location.account')
            ->exists();
    }

    public function canManageVehicle(User $user, Vehicle $vehicle): bool
    {
        if (! $this->registryRecordLocationMatches($vehicle->location, $vehicle->account_id)) {
            return false;
        }

        return $this->canManageRegistry($user, $vehicle->location);
    }

    public function residentForUser(User $user): ?Resident
    {
        return Resident::query()
            ->where('user_id', $user->id)
            ->where('status', RegistryStatus::Active)
            ->whereHas('account')
            ->first();
    }

    /**
     * @return Builder<UnitMembership>
     */
    public function activeResidentMembershipsForUser(User $user): Builder
    {
        $resident = $this->residentForUser($user);

        if (! $resident) {
            return UnitMembership::query()->whereKey([]);
        }

        return UnitMembership::query()
            ->where('resident_id', $resident->id)
            ->where('account_id', $resident->account_id)
            ->where('status', RegistryStatus::Active)
            ->whereHas('location')
            ->whereHas('unit', fn (Builder $query) => $query->where('status', RegistryStatus::Active));
    }

    public function canResidentAccessUnit(User $user, Unit $unit): bool
    {
        if ($unit->status !== RegistryStatus::Active || ! $this->registryRecordLocationMatches($unit->location, $unit->account_id)) {
            return false;
        }

        return $this->activeResidentMembershipsForUser($user)
            ->where('unit_id', $unit->id)
            ->exists();
    }

    public function canResidentManageVehicle(User $user, Vehicle $vehicle): bool
    {
        if (! $this->registryRecordLocationMatches($vehicle->location, $vehicle->account_id)) {
            return false;
        }

        return $this->canResidentAccessUnit($user, $vehicle->unit);
    }

    /**
     * Users that hold any Account or Location role in the Account.
     *
     * Uses the User role relations, so soft-deleted Accounts, Locations,
     * and role assignments are excluded with the same semantics as
     * canAccessAccount.
     *
     * @return Builder<User>
     */
    public function staffForAccount(Account $account): Builder
    {
        if ($account->trashed()) {
            return User::query()->whereKey([]);
        }

        return User::query()->where(function (Builder $query) use ($account): void {
            $query
                ->whereHas('accountUserRoles', fn (Builder $query) => $query->where('account_id', $account->id))
                ->orWhereHas('locationUserRoles', fn (Builder $query) => $query->where('account_id', $account->id));
        });
    }

    public function isStaffForAccount(User $user, Account $account): bool
    {
        return $this->staffForAccount($account)
            ->whereKey($user->id)
            ->exists();
    }

    /**
     * @return Builder<Location>
     */
    public function accessibleLocationsForAccount(User $user, Account $account): Builder
    {
        if ($account->trashed()) {
            return Location::query()->whereKey([]);
        }

        if ($this->hasAccountRole($user, $account, AccountRole::AccountAdmin)) {
            return $account->locations()->getQuery();
        }

        return Location::query()
            ->where('account_id', $account->id)
            ->whereIn('id', LocationUserRole::query()
                ->select('location_id')
                ->where('account_id', $account->id)
                ->where('user_id', $user->id));
    }

    /**
     * The single owner of soft-delete liveness: a location counts only when
     * neither it nor its account is trashed.
     */
    private function isLiveLocation(Location $location): bool
    {
        return ! $location->trashed()
            && Account::query()->whereKey($location->account_id)->exists();
    }

    private function registryRecordLocationMatches(?Location $location, string $accountId): bool
    {
        return $location !== null
            && $location->account_id === $accountId
            && $this->isLiveLocation($location);
    }
}
