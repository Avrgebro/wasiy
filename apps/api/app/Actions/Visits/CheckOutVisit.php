<?php

namespace App\Actions\Visits;

use App\Enums\ActivityEventType;
use App\Enums\VisitStatus;
use App\Models\User;
use App\Models\Visit;
use App\Services\ActivityLogger;
use Illuminate\Validation\ValidationException;

/** One way: inside → left. The desk marks it, or the system does after the configured hours. */
class CheckOutVisit
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Visit $visit, ?User $actor, ?string $notes = null, bool $automatic = false): Visit
    {
        if ($visit->status !== VisitStatus::Inside) {
            throw ValidationException::withMessages([
                'status' => __('This visit was already checked out.'),
            ]);
        }

        $visit->forceFill([
            'status' => VisitStatus::Left,
            'checked_out_by' => $actor?->id,
            'checked_out_at' => now(),
            'checkout_notes' => $notes,
            'auto_checked_out' => $automatic,
        ])->save();

        $visit->loadMissing(['unit', 'location', 'account']);

        $this->activityLogger->log(
            account: $visit->account,
            eventType: ActivityEventType::VisitCheckedOut,
            summary: $automatic
                ? "Salida automática de {$visit->visitor_name} (unidad {$visit->unit->label()})."
                : "Salida de {$visit->visitor_name} (unidad {$visit->unit->label()}).",
            metadata: [
                'visit_id' => $visit->id,
                'unit_id' => $visit->unit_id,
                'unit_label' => $visit->unit->label(),
                'resident_id' => $visit->resident_id,
                'automatic' => $automatic,
                'checkout_notes' => $notes,
            ],
            location: $visit->location,
            actor: $actor,
            subjectType: 'visit',
            subjectId: $visit->id,
        );

        return $visit;
    }
}
