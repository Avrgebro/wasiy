<?php

namespace App\Actions\Finances;

use App\Enums\ActivityEventType;
use App\Enums\MovementStatus;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Single writer for new ledger rows: manual records from the drawer and
 * reservation-generated fees and deposits both land here.
 */
class RecordMovement
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes  fillable columns, without account/location
     */
    public function handle(Location $location, User $actor, array $attributes, MovementStatus $status = MovementStatus::Pending): FinancialMovement
    {
        return DB::transaction(function () use ($location, $actor, $attributes, $status): FinancialMovement {
            $movement = new FinancialMovement([
                ...$attributes,
                'account_id' => $location->account_id,
                'location_id' => $location->id,
            ]);
            $settled = $status !== MovementStatus::Pending;
            $movement->forceFill([
                'status' => $status,
                'created_by' => $actor->id,
                'settled_by' => $settled ? $actor->id : null,
                'settled_at' => $settled ? now() : null,
            ]);
            $movement->save();

            $this->activityLogger->log(
                account: $location->account,
                eventType: ActivityEventType::MovementRecorded,
                summary: "Se registró un movimiento: {$movement->concept} (".Money::soles($movement->amount_minor).').',
                metadata: MovementMetadata::for($movement),
                location: $location,
                actor: $actor,
                subjectType: 'financial_movement',
                subjectId: $movement->id,
            );

            return $movement;
        });
    }
}
