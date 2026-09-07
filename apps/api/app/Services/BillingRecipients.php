<?php

namespace App\Services;

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\StaffMembership;
use Illuminate\Support\Collection;

/** Who hears about an account's billing: its active account admins (ADR 0040). */
class BillingRecipients
{
    /** @return Collection<int, string> */
    public function adminEmails(Account $account): Collection
    {
        return StaffMembership::query()
            ->where('account_id', $account->id)
            ->where('account_role', AccountRole::AccountAdmin->value)
            ->whereNull('deactivated_at')
            ->with('user')
            ->get()
            ->map(fn (StaffMembership $membership) => $membership->user?->deactivated_at === null ? $membership->user?->email : null)
            ->filter()
            ->unique()
            ->values();
    }
}
