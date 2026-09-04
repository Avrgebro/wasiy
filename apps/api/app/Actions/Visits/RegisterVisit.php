<?php

namespace App\Actions\Visits;

use App\Enums\ActivityEventType;
use App\Enums\VisitConfirmation;
use App\Enums\VisitStatus;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\User;
use App\Models\Visit;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

class RegisterVisit
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array{visitor_name: string, document?: string|null, phone?: string|null, confirmation?: string|null, notes?: string|null}  $data
     */
    public function handle(Unit $unit, ?Resident $host, User $actor, array $data): Visit
    {
        return DB::transaction(function () use ($unit, $host, $actor, $data): Visit {
            $confirmation = VisitConfirmation::tryFrom((string) ($data['confirmation'] ?? '')) ?? VisitConfirmation::None;

            $visit = new Visit([
                'account_id' => $unit->account_id,
                'location_id' => $unit->location_id,
                'unit_id' => $unit->id,
                'resident_id' => $host?->id,
                'visitor_name' => trim($data['visitor_name']),
                'document' => $data['document'] ?? null,
                'phone' => $data['phone'] ?? null,
                'confirmation' => $confirmation,
                'notes' => $data['notes'] ?? null,
            ]);
            $visit->forceFill([
                'status' => VisitStatus::Inside,
                'checked_in_by' => $actor->id,
                'checked_in_at' => now(),
            ])->save();

            $this->activityLogger->log(
                account: $unit->account,
                eventType: ActivityEventType::VisitCheckedIn,
                summary: "Ingreso de {$visit->visitor_name} a la unidad {$unit->label()}.",
                metadata: [
                    'visit_id' => $visit->id,
                    'unit_id' => $unit->id,
                    'unit_label' => $unit->label(),
                    'resident_id' => $host?->id,
                    'resident_name' => $host?->name,
                    'confirmation' => $confirmation->value,
                ],
                location: $unit->location,
                actor: $actor,
                subjectType: 'visit',
                subjectId: $visit->id,
            );

            return $visit;
        });
    }
}
