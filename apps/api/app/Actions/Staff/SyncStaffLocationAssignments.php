<?php

namespace App\Actions\Staff;

use App\Models\Account;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Support\Collection;

class SyncStaffLocationAssignments
{
    /**
     * Replace the staff User's Location roles in the Account and return the
     * change-set so callers decide what to log. Must run inside the caller's
     * database transaction.
     *
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     * @return Collection<int, array{location: Location|null, role_before: string|null, role_after: string|null}>
     */
    public function sync(Account $account, User $staff, array $locationAssignments): Collection
    {
        $desiredAssignments = collect($locationAssignments)
            ->keyBy('location_id');

        $existingAssignments = LocationUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $staff->id)
            ->with('location')
            ->get()
            ->keyBy('location_id');

        $desiredLocations = Location::query()
            ->where('account_id', $account->id)
            ->whereIn('id', $desiredAssignments->keys())
            ->get()
            ->keyBy('id');

        $changes = collect();

        foreach ($existingAssignments as $locationId => $assignment) {
            if (! $desiredAssignments->has($locationId)) {
                $assignment->delete();

                $changes->push([
                    'location' => $assignment->location,
                    'role_before' => $assignment->role->value,
                    'role_after' => null,
                ]);
            }
        }

        foreach ($desiredAssignments as $locationId => $assignmentData) {
            $existingAssignment = $existingAssignments->get($locationId);

            if (! $existingAssignment instanceof LocationUserRole) {
                LocationUserRole::query()->create([
                    'account_id' => $account->id,
                    'location_id' => $locationId,
                    'user_id' => $staff->id,
                    'role' => $assignmentData['role'],
                ]);

                $changes->push([
                    'location' => $desiredLocations->get($locationId),
                    'role_before' => null,
                    'role_after' => $assignmentData['role'],
                ]);

                continue;
            }

            if ($existingAssignment->role->value !== $assignmentData['role']) {
                $roleBefore = $existingAssignment->role->value;

                $existingAssignment->forceFill([
                    'role' => $assignmentData['role'],
                ])->save();

                $changes->push([
                    'location' => $desiredLocations->get($locationId),
                    'role_before' => $roleBefore,
                    'role_after' => $assignmentData['role'],
                ]);
            }
        }

        return $changes;
    }

    /**
     * Whether applying the submitted assignments would grant the staff User a
     * Location role they do not already hold.
     *
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     */
    public function wouldGrantAccess(Account $account, User $staff, array $locationAssignments): bool
    {
        $existingAssignments = LocationUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $staff->id)
            ->get()
            ->keyBy('location_id');

        return collect($locationAssignments)->contains(
            fn (array $assignment): bool => $existingAssignments
                ->get($assignment['location_id'])
                ?->role
                ->value !== $assignment['role'],
        );
    }
}
