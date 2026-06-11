<?php

namespace App\Actions\Staff;

use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

class UpdateStaffLocationAssignments
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     */
    public function handle(Account $account, User $actor, User $staff, array $locationAssignments): User
    {
        abort_unless($this->isStaffForAccount($account, $staff), 404);

        return DB::transaction(function () use ($account, $actor, $staff, $locationAssignments): User {
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

            foreach ($existingAssignments as $locationId => $assignment) {
                if (! $desiredAssignments->has($locationId)) {
                    $assignment->delete();

                    if ($assignment->location instanceof Location) {
                        $this->logLocationAssignmentChange(
                            account: $account,
                            actor: $actor,
                            staff: $staff,
                            location: $assignment->location,
                            roleBefore: $assignment->role->value,
                            roleAfter: null,
                        );
                    }
                }
            }

            foreach ($desiredAssignments as $locationId => $assignmentData) {
                $existingAssignment = $existingAssignments->get($locationId);
                $location = $desiredLocations->get($locationId);

                if (! $existingAssignment instanceof LocationUserRole) {
                    LocationUserRole::query()->create([
                        'account_id' => $account->id,
                        'location_id' => $locationId,
                        'user_id' => $staff->id,
                        'role' => $assignmentData['role'],
                    ]);

                    if ($location instanceof Location) {
                        $this->logLocationAssignmentChange(
                            account: $account,
                            actor: $actor,
                            staff: $staff,
                            location: $location,
                            roleBefore: null,
                            roleAfter: $assignmentData['role'],
                        );
                    }

                    continue;
                }

                if ($existingAssignment->role->value !== $assignmentData['role']) {
                    $roleBefore = $existingAssignment->role->value;

                    $existingAssignment->forceFill([
                        'role' => $assignmentData['role'],
                    ])->save();

                    if ($location instanceof Location) {
                        $this->logLocationAssignmentChange(
                            account: $account,
                            actor: $actor,
                            staff: $staff,
                            location: $location,
                            roleBefore: $roleBefore,
                            roleAfter: $assignmentData['role'],
                        );
                    }
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

    private function logLocationAssignmentChange(
        Account $account,
        User $actor,
        User $staff,
        Location $location,
        ?string $roleBefore,
        ?string $roleAfter,
    ): void {
        if ($roleBefore === $roleAfter) {
            return;
        }

        $eventType = match (true) {
            $roleBefore === null => ActivityEventType::StaffRoleAssigned,
            $roleAfter === null => ActivityEventType::StaffRoleRemoved,
            default => ActivityEventType::StaffLocationsChanged,
        };

        $summary = match ($eventType) {
            ActivityEventType::StaffRoleAssigned => "{$staff->name} recibió el rol {$this->locationRoleLabel($roleAfter)} en {$location->name}.",
            ActivityEventType::StaffRoleRemoved => "Se quitó el rol {$this->locationRoleLabel($roleBefore)} a {$staff->name} en {$location->name}.",
            ActivityEventType::StaffLocationsChanged => "{$staff->name} cambió de {$this->locationRoleLabel($roleBefore)} a {$this->locationRoleLabel($roleAfter)} en {$location->name}.",
            default => "{$staff->name} tuvo un cambio de rol en {$location->name}.",
        };

        $this->activityLogger->log(
            account: $account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'actor_user_email' => $actor->email,
                'account_id' => $account->id,
                'account_name' => $account->name,
                'staff_user_id' => $staff->id,
                'staff_user_name' => $staff->name,
                'staff_user_email' => $staff->email,
                'location_id' => $location->id,
                'location_name' => $location->name,
                'location_role_before' => $roleBefore,
                'location_role_after' => $roleAfter,
            ],
            location: $location,
            actor: $actor,
            subjectType: 'user',
            subjectId: $staff->id,
        );
    }

    private function locationRoleLabel(?string $role): string
    {
        return match ($role) {
            'front_desk' => 'Recepción / Seguridad',
            'location_manager' => 'Administrador de ubicación',
            default => 'sin rol',
        };
    }
}
