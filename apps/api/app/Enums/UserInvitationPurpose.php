<?php

namespace App\Enums;

enum UserInvitationPurpose: string
{
    case Staff = 'staff';
    case Resident = 'resident';
}
