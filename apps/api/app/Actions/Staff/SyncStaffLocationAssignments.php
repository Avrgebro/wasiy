<?php

namespace App\Actions\Staff;

use App\Models\Location;
use App\Models\StaffLocationRole;
use App\Models\StaffMembership;
use Illuminate\Support\Collection;

class SyncStaffLocationAssignments
{
    /**
     * Replace the membership's Location roles and return the change-set so
     * callers decide what to log. Must run inside the caller's database
     * transaction.
     *
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     * @return Collection<int, array{location: Location|null, role_before: string|null, role_after: string|null}>
     */
    public function sync(StaffMembership $membership, array $locationAssignments): Collection
    {
        $desiredAssignments = collect($locationAssignments)
            ->keyBy('location_id');

        $existingAssignments = StaffLocationRole::query()
            ->where('staff_membership_id', $membership->id)
            ->with('location')
            ->get()
            ->keyBy('location_id');

        $desiredLocations = Location::query()
            ->where('account_id', $membership->account_id)
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

            if (! $existingAssignment instanceof StaffLocationRole) {
                StaffLocationRole::query()->create([
                    'staff_membership_id' => $membership->id,
                    'account_id' => $membership->account_id,
                    'location_id' => $locationId,
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
}
