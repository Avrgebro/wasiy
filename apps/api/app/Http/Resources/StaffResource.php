<?php

namespace App\Http\Resources;

use App\Models\StaffLocationRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use LogicException;

/**
 * Callers must eager-load the Account-scoped staff membership via
 * User::staffRelationsForAccount() before passing the User here; the
 * resource renders the loaded membership as-is.
 *
 * @mixin User
 */
class StaffResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        if (! $this->resource->relationLoaded('staffMemberships')) {
            throw new LogicException(
                'StaffResource requires the Account-scoped staff membership. Load it with User::staffRelationsForAccount().',
            );
        }

        $membership = $this->resource->staffMemberships->first();

        if ($membership === null) {
            throw new LogicException(
                'StaffResource received a User with no StaffMembership for the Account.',
            );
        }

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'email' => $this->email,
            // Per-account suspension lives on the membership; the User-level
            // timestamp is a platform ban and is not surfaced here.
            'deactivated_at' => $membership->deactivated_at?->toJSON(),
            'account_role' => $membership->account_role?->value,
            'location_assignments' => $membership->locationRoles
                ->sortBy(fn (StaffLocationRole $assignment) => $assignment->location?->name ?? '')
                ->map(fn (StaffLocationRole $assignment) => [
                    'location_id' => $assignment->location_id,
                    'location_name' => $assignment->location?->name,
                    'role' => $assignment->role->value,
                ])
                ->values()
                ->all(),
        ];
    }
}
