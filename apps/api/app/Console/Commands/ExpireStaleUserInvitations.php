<?php

namespace App\Console\Commands;

use App\Enums\UserInvitationStatus;
use App\Models\UserInvitation;
use Illuminate\Console\Command;

class ExpireStaleUserInvitations extends Command
{
    protected $signature = 'invitations:expire-stale';

    protected $description = 'Mark pending user invitations past their expiry date as expired';

    public function handle(): int
    {
        $expired = UserInvitation::query()
            ->where('status', UserInvitationStatus::Pending->value)
            ->where('expires_at', '<=', now())
            ->update(['status' => UserInvitationStatus::Expired->value]);

        $this->info("Expired {$expired} stale invitation(s).");

        return self::SUCCESS;
    }
}
