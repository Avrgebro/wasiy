<?php

namespace App\Actions\Staff;

use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateStaffLocationAssignments
{
    /**
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     */
    public function handle(Account $account, User $staff, array $locationAssignments): User
    {
        abort_unless($this->isStaffForAccount($account, $staff), 404);

        return DB::transaction(function () use ($account, $staff, $locationAssignments): User {
            $desiredAssignments = collect($locationAssignments)
                ->keyBy('location_id');

            $existingAssignments = LocationUserRole::query()
                ->where('account_id', $account->id)
                ->where('user_id', $staff->id)
                ->get()
                ->keyBy('location_id');

            foreach ($existingAssignments as $locationId => $assignment) {
                if (! $desiredAssignments->has($locationId)) {
                    $assignment->delete();
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

                    continue;
                }

                if ($existingAssignment->role->value !== $assignmentData['role']) {
                    $existingAssignment->forceFill([
                        'role' => $assignmentData['role'],
                    ])->save();
                }
            }

            return $this->loadStaffRelations($staff, $account);
        });
    }

    private function isStaffForAccount(Account $account, User $user): bool
    {
        return AccountUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $user->id)
            ->exists()
            || LocationUserRole::query()
                ->where('account_id', $account->id)
                ->where('user_id', $user->id)
                ->exists();
    }

    private function loadStaffRelations(User $user, Account $account): User
    {
        return $user->load([
            'accountUserRoles' => fn ($query) => $query->where('account_id', $account->id),
            'locationUserRoles' => fn ($query) => $query
                ->where('account_id', $account->id)
                ->with('location'),
        ]);
    }
}
