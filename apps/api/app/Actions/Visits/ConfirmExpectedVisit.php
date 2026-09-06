<?php

namespace App\Actions\Visits;

use App\Enums\ActivityEventType;
use App\Enums\ResidentAlertKind;
use App\Enums\VisitConfirmation;
use App\Enums\VisitStatus;
use App\Models\User;
use App\Models\Visit;
use App\Services\ActivityLogger;
use App\Services\ResidentAlerts;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The desk confirms a pre-registered visitor arrived: expected → inside. The
 * desk may correct the name or document and add its own notes; the
 * confirmation method stays PreRegistered because the resident already
 * authorised the visit.
 */
class ConfirmExpectedVisit
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly ResidentAlerts $alerts,
    ) {}

    /**
     * @param  array{visitor_name?: string|null, document?: string|null, phone?: string|null, notes?: string|null}  $overrides
     */
    public function handle(Visit $visit, User $actor, array $overrides = []): Visit
    {
        if ($visit->status !== VisitStatus::Expected) {
            throw ValidationException::withMessages(['status' => __('Only an expected visit can be confirmed.')]);
        }

        return DB::transaction(function () use ($visit, $actor, $overrides): Visit {
            $visit->fill(array_filter([
                'visitor_name' => isset($overrides['visitor_name']) ? trim($overrides['visitor_name']) : null,
                'document' => $overrides['document'] ?? null,
                'phone' => $overrides['phone'] ?? null,
                'notes' => $overrides['notes'] ?? null,
            ], fn ($value) => $value !== null && $value !== ''));
            $visit->forceFill([
                'status' => VisitStatus::Inside,
                'confirmation' => VisitConfirmation::PreRegistered,
                'checked_in_by' => $actor->id,
                'checked_in_at' => now(),
            ])->save();

            $visit->loadMissing(['unit', 'location', 'account', 'resident']);

            $this->activityLogger->log(
                account: $visit->account,
                eventType: ActivityEventType::VisitCheckedIn,
                summary: "Ingreso de {$visit->visitor_name} a la unidad {$visit->unit->label()} (pre-registrado).",
                metadata: [
                    'visit_id' => $visit->id,
                    'unit_id' => $visit->unit_id,
                    'unit_label' => $visit->unit->label(),
                    'resident_id' => $visit->resident_id,
                    'resident_name' => $visit->resident?->name,
                    'confirmation' => VisitConfirmation::PreRegistered->value,
                    'pre_registered' => true,
                ],
                location: $visit->location,
                actor: $actor,
                subjectType: 'visit',
                subjectId: $visit->id,
            );

            $this->alerts->send(
                unit: $visit->unit,
                kind: ResidentAlertKind::VisitArrived,
                title: 'Visitante llegó',
                body: "{$visit->visitor_name} ingresó a tu unidad.",
                subject: $visit,
                facts: [
                    ['label' => 'Visitante', 'value' => $visit->visitor_name],
                    ['label' => 'Unidad', 'value' => $visit->unit->label()],
                    ['label' => 'Ingreso', 'value' => $visit->checked_in_at->setTimezone($visit->unit->location->timezone)->locale('es')->isoFormat('D [de] MMMM, HH:mm')],
                ],
                intro: 'Recepción registró el ingreso de un visitante a tu unidad.',
                actionLabel: 'Ver visitas',
                actionPath: '/portal/visitas',
            );

            return $visit;
        });
    }
}
