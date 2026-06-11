<?php

namespace App\Services;

use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\User;

class ActivityLogger
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function log(
        Account $account,
        ActivityEventType $eventType,
        string $summary,
        array $metadata = [],
        ?Location $location = null,
        ?User $actor = null,
        ?string $subjectType = null,
        ?string $subjectId = null,
    ): ActivityLog {
        return ActivityLog::query()->create([
            'account_id' => $account->id,
            'location_id' => $location?->id,
            'actor_user_id' => $actor?->id,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'event_type' => $eventType,
            'summary' => $summary,
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }
}
