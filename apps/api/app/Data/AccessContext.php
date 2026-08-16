<?php

namespace App\Data;

use Illuminate\Contracts\Support\Arrayable;
use JsonSerializable;

/**
 * The app-shell contract: everything the SPA needs to bootstrap a session.
 * This is the single declaration site of the /me payload shape.
 *
 * @implements Arrayable<string, mixed>
 */
class AccessContext implements Arrayable, JsonSerializable
{
    /**
     * @param  array{id: string, first_name: string, last_name: string, name: string, email: string}  $user
     * @param  array<int, array<string, string|null>>  $accounts
     * @param  array<string, string|null>|null  $activeAccount
     * @param  array<string, mixed>|null  $activeLocation
     * @param  array{account: array<int, array<string, string>>, location: array<int, array<string, string>>}  $roles
     * @param  array<int, array<string, mixed>>  $accessibleLocations
     * @param  array<int, array<string, mixed>>  $residentMemberships
     */
    public function __construct(
        public readonly array $user,
        public readonly array $accounts,
        public readonly ?array $activeAccount,
        public readonly ?array $activeLocation,
        public readonly array $roles,
        public readonly array $accessibleLocations,
        public readonly array $residentMemberships,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'user' => $this->user,
            'accounts' => $this->accounts,
            'active_account' => $this->activeAccount,
            'active_location' => $this->activeLocation,
            'roles' => $this->roles,
            'accessible_locations' => $this->accessibleLocations,
            'resident_memberships' => $this->residentMemberships,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
