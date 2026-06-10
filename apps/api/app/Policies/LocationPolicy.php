<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Models\Location;
use App\Models\User;

class LocationPolicy
{
    public function view(User $user, Location $location): bool
    {
        if (! $location->account()->exists()) {
            return false;
        }

        return $user->accountUserRoles()
            ->where('account_id', $location->account_id)
            ->where('role', AccountRole::AccountAdmin->value)
            ->exists()
            || $user->locationUserRoles()
                ->where('location_id', $location->id)
                ->exists();
    }
}
