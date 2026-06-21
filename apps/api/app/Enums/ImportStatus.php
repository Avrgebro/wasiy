<?php

namespace App\Enums;

enum ImportStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case ReadyForReview = 'ready_for_review';
    case Failed = 'failed';
    case Completed = 'completed';
}
