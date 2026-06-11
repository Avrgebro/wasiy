<?php

namespace App\Http\Resources;

use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use LogicException;

/**
 * Callers must eager-load the Account-scoped staff relations via
 * User::staffRelationsForAccount() before passing the User here; the
 * resource renders the loaded relations as-is.
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
        if (! $this->resource->relationLoaded('accountUserRoles')
            || ! $this->resource->relationLoaded('locationUserRoles')) {
            throw new LogicException(
                'StaffResource requires Account-scoped staff relations. Load them with User::staffRelationsForAccount().',
            );
        }

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'email' => $this->email,
            'deactivated_at' => $this->deactivated_at?->toJSON(),
            'account_roles' => $this->accountUserRoles
                ->map(fn ($assignment) => $assignment->role->value)
                ->values()
                ->all(),
            'location_assignments' => $this->locationUserRoles
                ->sortBy(fn (LocationUserRole $assignment) => $assignment->location?->name ?? '')
                ->map(fn (LocationUserRole $assignment) => [
                    'location_id' => $assignment->location_id,
                    'location_name' => $assignment->location?->name,
                    'role' => $assignment->role->value,
                ])
                ->values()
                ->all(),
        ];
    }
}
