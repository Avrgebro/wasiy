<?php

namespace App\Actions\Staff;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\StaffMembership;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Per-account suspension (ADR 0033): the membership and its role rows stay
 * for history and the staff list, but a deactivated membership grants no
 * access in the Account. The User can still sign in and keeps access to any
 * other Accounts.
 */
class DeactivateStaffMembership
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Account $account, User $actor, User $staff): User
    {
        return DB::transaction(function () use ($account, $actor, $staff): User {
            // Lock the Account's active admin memberships so concurrent
            // deactivations cannot each pass the last-admin check and leave
            // an account without any active admin.
            $adminMemberships = StaffMembership::query()
                ->where('account_id', $account->id)
                ->where('account_role', AccountRole::AccountAdmin->value)
                ->whereNull('deactivated_at')
                ->lockForUpdate()
                ->get();

            if (! $adminMemberships->contains('user_id', $actor->id)) {
                abort(403);
            }

            if ($actor->id === $staff->id) {
                throw ValidationException::withMessages([
                    'user' => __('You cannot deactivate your own access.'),
                ]);
            }

            $membership = StaffMembership::query()
                ->where('account_id', $account->id)
                ->where('user_id', $staff->id)
                ->lockForUpdate()
                ->first();

            if (! $membership instanceof StaffMembership) {
                abort(404);
            }

            if ($membership->isDeactivated()) {
                return $staff->loadStaffRelationsForAccount($account);
            }

            if ($membership->account_role === AccountRole::AccountAdmin
                && $adminMemberships->where('user_id', '!=', $staff->id)->isEmpty()) {
                throw ValidationException::withMessages([
                    'user' => __('Add another Account Admin before deactivating this member.'),
                ]);
            }

            $membership->deactivate();

            $this->activityLogger->log(
                account: $account,
                eventType: ActivityEventType::StaffDeactivated,
                summary: "Se desactivó el acceso de {$staff->name} en {$account->name}.",
                metadata: $this->metadata($account, $actor, $staff),
                actor: $actor,
                subjectType: 'user',
                subjectId: $staff->id,
            );

            return $staff->loadStaffRelationsForAccount($account);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function metadata(Account $account, User $actor, User $staff): array
    {
        return [
            'actor_user_id' => $actor->id,
            'actor_user_name' => $actor->name,
            'actor_user_email' => $actor->email,
            'account_id' => $account->id,
            'account_name' => $account->name,
            'staff_user_id' => $staff->id,
            'staff_user_name' => $staff->name,
            'staff_user_email' => $staff->email,
        ];
    }
}
