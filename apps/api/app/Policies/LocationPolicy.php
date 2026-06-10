<?php

namespace App\Policies;

use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class LocationPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function view(User $user, Location $location): bool
    {
        return $this->access->canAccessLocation($user, $location);
    }
}
