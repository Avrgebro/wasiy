<?php

namespace App\Http\Resources;

use App\Models\Account;
use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
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
        /** @var Account $account */
        $account = $request->route('account');

        $this->resource->loadMissing([
            'accountUserRoles',
            'locationUserRoles.location',
        ]);

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'email' => $this->email,
            'deactivated_at' => $this->deactivated_at?->toJSON(),
            'account_roles' => $this->accountUserRoles
                ->where('account_id', $account->id)
                ->map(fn ($assignment) => $assignment->role->value)
                ->values()
                ->all(),
            'location_assignments' => $this->locationUserRoles
                ->where('account_id', $account->id)
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
