<?php

namespace App\Services;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
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
        if ($location->trashed() || ! $this->locationAccountExists($location)) {
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
        if ($account->trashed()) {
            return false;
        }

        return AccountUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $user->id)
            ->exists()
            || LocationUserRole::query()
                ->where('account_id', $account->id)
                ->where('user_id', $user->id)
                ->whereHas('location')
                ->exists();
    }

    public function canAccessLocation(User $user, Location $location): bool
    {
        if ($location->trashed() || ! $this->locationAccountExists($location)) {
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

    private function locationAccountExists(Location $location): bool
    {
        return Account::query()
            ->whereKey($location->account_id)
            ->exists();
    }
}
