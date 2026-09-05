<?php

namespace App\Actions\Locations;

use App\Enums\ActivityEventType;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Retiring a property: the Location keeps its Units, Residents, and history,
 * disappears from accessible_locations, and is rejected as an Active
 * Location. Not a soft delete — that stays reserved for genuine mistakes.
 */
class DeactivateLocation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Location $location, User $actor): Location
    {
        return DB::transaction(function () use ($location, $actor): Location {
            // Lock the Account's active Locations so concurrent deactivations
            // cannot each pass the last-active check and leave the Account
            // with no operational scope.
            $activeLocations = Location::query()
                ->where('account_id', $location->account_id)
                ->active()
                ->lockForUpdate()
                ->get();

            if ($activeLocations->count() <= 1 && $activeLocations->contains('id', $location->id)) {
                throw ValidationException::withMessages([
                    'location' => __('This is the last active location in the account. Create or reactivate another location first.'),
                ]);
            }

            if ($location->isDeactivated()) {
                return $location;
            }

            $location->deactivate($actor);

            $this->activityLogger->log(
                account: $location->account,
                eventType: ActivityEventType::LocationDeactivated,
                summary: "Se desactivó la ubicación {$location->name}.",
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
