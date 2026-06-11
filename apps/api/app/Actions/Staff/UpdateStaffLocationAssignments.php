<?php

namespace App\Actions\Staff;

use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateStaffLocationAssignments
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly SyncStaffLocationAssignments $syncLocationAssignments,
    ) {}

    /**
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     */
    public function handle(Account $account, User $actor, User $staff, array $locationAssignments): User
    {
        return DB::transaction(function () use ($account, $actor, $staff, $locationAssignments): User {
            if ($staff->isDeactivated()
                && $this->syncLocationAssignments->wouldGrantAccess($account, $staff, $locationAssignments)) {
                throw ValidationException::withMessages([
                    'location_assignments' => __('This user is deactivated and cannot be granted new access.'),
                ]);
            }

            $changes = $this->syncLocationAssignments->sync($account, $staff, $locationAssignments);

            foreach ($changes as $change) {
                if ($change['location'] instanceof Location) {
                    $this->logLocationAssignmentChange(
                        account: $account,
                        actor: $actor,
                        staff: $staff,
                        location: $change['location'],
                        roleBefore: $change['role_before'],
                        roleAfter: $change['role_after'],
                    );
                }
            }

            return $staff->loadStaffRelationsForAccount($account);
        });
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
