<?php

namespace App\Actions\Visits;

use App\Enums\ActivityEventType;
use App\Enums\VisitConfirmation;
use App\Enums\VisitStatus;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\Visit;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

/** A resident announces a visitor from the portal; the desk confirms the arrival later. */
class PreRegisterVisit
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array{visitor_name: string, document?: string|null, expected_on: string, expected_time?: string|null, notes?: string|null}  $data
     */
    public function handle(Unit $unit, Resident $resident, array $data): Visit
    {
        return DB::transaction(function () use ($unit, $resident, $data): Visit {
            $visit = new Visit([
                'account_id' => $unit->account_id,
                'location_id' => $unit->location_id,
                'unit_id' => $unit->id,
                'resident_id' => $resident->id,
                'visitor_name' => trim($data['visitor_name']),
                'document' => $data['document'] ?? null,
                'confirmation' => VisitConfirmation::PreRegistered,
                'notes' => $data['notes'] ?? null,
            ]);
            $visit->forceFill([
                'status' => VisitStatus::Expected,
                'expected_on' => $data['expected_on'],
                'expected_time' => $data['expected_time'] ?? null,
                'pre_registered_by' => $resident->id,
                'pre_registered_at' => now(),
            ])->save();

            $this->activityLogger->log(
                account: $unit->account,
                eventType: ActivityEventType::VisitPreRegistered,
                summary: "{$resident->name} pre-registró a {$visit->visitor_name} para la unidad {$unit->label()}.",
                metadata: [
                    'visit_id' => $visit->id,
                    'unit_id' => $unit->id,
                    'unit_label' => $unit->label(),
                    'resident_id' => $resident->id,
                    'resident_name' => $resident->name,
                    'expected_on' => $data['expected_on'],
                    'expected_time' => $data['expected_time'] ?? null,
                ],
                location: $unit->location,
                actor: $resident->user,
                subjectType: 'visit',
                subjectId: $visit->id,
            );

            return $visit;
        });
    }
}
