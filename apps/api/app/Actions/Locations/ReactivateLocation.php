<?php

namespace App\Actions\Locations;

use App\Enums\ActivityEventType;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

class ReactivateLocation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Location $location, User $actor): Location
    {
        return DB::transaction(function () use ($location, $actor): Location {
            if (! $location->isDeactivated()) {
                return $location;
            }

            $location->reactivate();

            $this->activityLogger->log(
                account: $location->account,
                eventType: ActivityEventType::LocationReactivated,
                summary: "Se reactivó la ubicación {$location->name}.",
                metadata: [
                    'location_id' => $location->id,
                    'location_name' => $location->name,
                ],
                location: $location,
                actor: $actor,
                subjectType: 'location',
                subjectId: $location->id,
            );

            return $location;
        });
    }
}
