<?php

namespace App\Services;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Models\Account;
use App\Models\Location;
use App\Models\Resident;
use App\Models\StaffLocationRole;
use App\Models\StaffMembership;
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
        // Access requires an ACTIVE membership; a deactivated membership
        // keeps the person listed as staff but grants nothing.
        return Account::query()
            ->whereIn('id', $this->activeMemberships($user)->select('account_id'));
    }

    public function hasAccountRole(User $user, Account $account, AccountRole $role): bool
    {
        if ($account->trashed()) {
            return false;
        }

        return $this->activeMemberships($user)
            ->where('account_id', $account->id)
            ->where('account_role', $role->value)
            ->exists();
    }

    public function hasLocationRole(User $user, Location $location, LocationRole $role): bool
    {
        if (! $this->isLiveLocation($location)) {
            return false;
        }

        return $this->activeMemberships($user)
            ->where('account_id', $location->account_id)
            ->whereHas('locationRoles', fn (Builder $query) => $query
                ->where('location_id', $location->id)
                ->where('role', $role->value))
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

        return $this->activeMemberships($user)
            ->where('account_id', $location->account_id)
            ->where(function (Builder $query) use ($location): void {
                $query
                    ->where('account_role', AccountRole::AccountAdmin->value)
                    ->orWhereHas('locationRoles', fn (Builder $query) => $query
                        ->where('location_id', $location->id));
            })
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
        // A trashed account resolves the relation to null; deny instead of
        // erroring inside the role check.
        if ($resident->account === null) {
            return null;
        }

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
            ->whereIn('location_id', StaffLocationRole::query()
                ->select('location_id')
                ->where('account_id', $resident->account_id)
                ->where('role', LocationRole::LocationManager->value)
                ->whereHas('membership', fn (Builder $query) => $query
                    ->where('user_id', $user->id)
                    ->whereNull('deactivated_at')))
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

        return $this->activeMemberships($user)
            ->where('account_id', $account->id)
            ->whereHas('locationRoles', fn (Builder $query) => $query
                ->where('role', LocationRole::LocationManager->value)
                ->whereHas('location.account'))
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
     * Users holding a StaffMembership in the Account — ANY status: the
     * staff list shows deactivated members (dimmed) with history intact.
     * Access checks are the ones that require an active membership.
     *
     * @return Builder<User>
     */
    public function staffForAccount(Account $account): Builder
    {
        if ($account->trashed()) {
            return User::query()->whereKey([]);
        }

        return User::query()->whereHas(
            'staffMemberships',
            fn (Builder $query) => $query->where('account_id', $account->id),
        );
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
            ->whereIn('id', StaffLocationRole::query()
                ->select('location_id')
                ->where('account_id', $account->id)
                ->whereHas('membership', fn (Builder $query) => $query
                    ->where('user_id', $user->id)
                    ->whereNull('deactivated_at')));
    }

    /**
     * Memberships that currently grant access: not deactivated, and in a
     * live account (relation guard on User::staffMemberships handles the
     * account; this queries the table directly, so re-check here).
     *
     * @return Builder<StaffMembership>
     */
    private function activeMemberships(User $user): Builder
    {
        return StaffMembership::query()
            ->where('user_id', $user->id)
            ->whereNull('deactivated_at')
            ->whereHas('account');
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
