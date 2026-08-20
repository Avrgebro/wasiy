<?php

namespace App\Actions\Staff;

use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\StaffMembership;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

/**
 * Lifts a per-account suspension: the membership's roles were kept, so the
 * member regains exactly the access they had when deactivated.
 */
class ReactivateStaffMembership
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Account $account, User $actor, User $staff): User
    {
        return DB::transaction(function () use ($account, $actor, $staff): User {
            $membership = StaffMembership::query()
                ->where('account_id', $account->id)
                ->where('user_id', $staff->id)
                ->lockForUpdate()
                ->first();

            if (! $membership instanceof StaffMembership) {
                abort(404);
            }

            if (! $membership->isDeactivated()) {
                return $staff->loadStaffRelationsForAccount($account);
            }

            $membership->activate();

            $this->activityLogger->log(
                account: $account,
                eventType: ActivityEventType::StaffReactivated,
                summary: "Se reactivó el acceso de {$staff->name} en {$account->name}.",
                metadata: [
                    'actor_user_id' => $actor->id,
                    'actor_user_name' => $actor->name,
                    'actor_user_email' => $actor->email,
                    'account_id' => $account->id,
                    'account_name' => $account->name,
                    'staff_user_id' => $staff->id,
                    'staff_user_name' => $staff->name,
                    'staff_user_email' => $staff->email,
                ],
                actor: $actor,
                subjectType: 'user',
                subjectId: $staff->id,
            );

            return $staff->loadStaffRelationsForAccount($account);
        });
    }
}
