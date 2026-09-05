<?php

namespace App\Actions\Visits;

use App\Enums\ActivityEventType;
use App\Enums\VisitStatus;
use App\Models\Resident;
use App\Models\Visit;
use App\Services\ActivityLogger;
use Illuminate\Validation\ValidationException;

/** The resident withdraws a pre-registration while nobody has arrived. */
class CancelExpectedVisit
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Visit $visit, Resident $resident): Visit
    {
        if ($visit->status !== VisitStatus::Expected) {
            throw ValidationException::withMessages(['status' => __('Only an expected visit can be cancelled.')]);
        }

        $visit->forceFill(['status' => VisitStatus::Cancelled, 'cancelled_at' => now()])->save();
        $visit->loadMissing(['unit', 'location', 'account']);

        $this->activityLogger->log(
            account: $visit->account,
            eventType: ActivityEventType::VisitCancelled,
            summary: "{$resident->name} canceló el pre-registro de {$visit->visitor_name} (unidad {$visit->unit->label()}).",
            metadata: ['visit_id' => $visit->id, 'unit_id' => $visit->unit_id, 'unit_label' => $visit->unit->label(), 'resident_id' => $resident->id],
            location: $visit->location,
            actor: $resident->user,
            subjectType: 'visit',
            subjectId: $visit->id,
        );

        return $visit;
    }
}
