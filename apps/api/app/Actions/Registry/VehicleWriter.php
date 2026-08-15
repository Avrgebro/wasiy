<?php

namespace App\Actions\Registry;

use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Models\Unit;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

/**
 * Shared vehicle write logic for the staff and portal controllers. Which
 * units the actor may target and which gate runs stay with the caller.
 */
class VehicleWriter
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(Unit $unit, array $attributes, User $actor): Vehicle
    {
        return DB::transaction(function () use ($unit, $attributes, $actor): Vehicle {
            $vehicle = Vehicle::query()->create([
                ...collect($attributes)->only(['vehicle_type', 'plate', 'make', 'model', 'color', 'notes'])->all(),
                'account_id' => $unit->account_id,
                'location_id' => $unit->location_id,
                'unit_id' => $unit->id,
                'status' => RegistryStatus::Active,
            ]);

            $this->log(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleCreated,
                summary: "Vehiculo {$vehicle->label()} creado para la unidad {$unit->label()}.",
                actor: $actor,
            );

            return $vehicle;
        });
    }

    /**
     * @param  array<int, string>  $changed
     */
    public function log(Vehicle $vehicle, ActivityEventType $eventType, string $summary, User $actor, array $changed = []): void
    {
        $vehicle->loadMissing(['account', 'location', 'unit']);

        $this->activityLogger->log(
            account: $vehicle->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'vehicle_id' => $vehicle->id,
                'vehicle_label' => $vehicle->label(),
                'plate' => $vehicle->plate,
                'unit_id' => $vehicle->unit_id,
                'unit_label' => $vehicle->unit->label(),
                'location_id' => $vehicle->location_id,
                'location_name' => $vehicle->location->name,
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'changed' => $changed,
            ],
            location: $vehicle->location,
            actor: $actor,
            subjectType: Vehicle::class,
            subjectId: $vehicle->id,
        );
    }
}
