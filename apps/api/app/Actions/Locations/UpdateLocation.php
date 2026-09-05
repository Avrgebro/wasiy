<?php

namespace App\Actions\Locations;

use App\Enums\ActivityEventType;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

class UpdateLocation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * Identity, address, and contact only — settings are written through
     * UpdateOperationalSettings so the Información form and the
     * Configuración groups never contend. The slug never changes on rename.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function handle(Location $location, User $actor, array $attributes): Location
    {
        return DB::transaction(function () use ($location, $actor, $attributes): Location {
            $location->fill($attributes);
            $changed = array_keys($location->getDirty());
            $location->save();

            if ($changed !== []) {
                $this->activityLogger->log(
                    account: $location->account,
                    eventType: ActivityEventType::LocationUpdated,
                    summary: "Se actualizó la ubicación {$location->name}.",
                    metadata: [
                        'location_id' => $location->id,
                        'location_name' => $location->name,
                        'changed_fields' => $changed,
                    ],
                    location: $location,
                    actor: $actor,
                    subjectType: 'location',
                    subjectId: $location->id,
                );
            }

            return $location;
        });
    }
}
