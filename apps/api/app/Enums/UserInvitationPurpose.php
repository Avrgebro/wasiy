<?php

namespace App\Enums;

use App\Models\UserInvitation;
use App\Notifications\ResidentInvitationNotification;
use App\Notifications\StaffInvitationNotification;
use Illuminate\Notifications\Notification;

enum UserInvitationPurpose: string
{
    case Staff = 'staff';
    case Resident = 'resident';

    public function expiresDays(): int
    {
        $key = match ($this) {
            self::Staff => 'wasiy.invitations.staff_expires_days',
            self::Resident => 'wasiy.invitations.resident_expires_days',
        };

        return max(1, (int) config($key, 14));
    }

    public function notification(UserInvitation $invitation, string $token): Notification
    {
        return match ($this) {
            self::Staff => new StaffInvitationNotification($invitation, $token),
            self::Resident => new ResidentInvitationNotification($invitation, $token),
        };
    }

    public function resentActivityEvent(): ActivityEventType
    {
        return match ($this) {
            self::Staff => ActivityEventType::StaffInvitationResent,
            self::Resident => ActivityEventType::ResidentInvitationResent,
        };
    }

    public function pendingConflictMessage(): string
    {
        return match ($this) {
            self::Staff => __('This email already has a pending staff invitation for this account.'),
            self::Resident => __('This email already has a pending resident invitation for this account.'),
        };
    }
}
