<?php

namespace App\Actions\Registry;

use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Services\ActivityLogger;

/**
 * Creates a unit membership for a resident, honoring the single-primary-
 * contact invariant, and writes the activity trail. Callers authorize and
 * open the transaction.
 */
class CreateUnitMembership
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array{resident_type: mixed, status?: mixed, is_primary_contact?: bool, started_at?: string|null, ended_at?: string|null}  $payload
     */
    public function handle(Resident $resident, Unit $unit, array $payload, User $actor): UnitMembership
    {
        $membership = $resident->unitMemberships()->create([
            'account_id' => $resident->account_id,
            'location_id' => $unit->location_id,
            'unit_id' => $unit->id,
            'resident_type' => $payload['resident_type'],
            'status' => $payload['status'] ?? RegistryStatus::Active,
            'is_primary_contact' => false,
            'started_at' => $payload['started_at'] ?? null,
            'ended_at' => $payload['ended_at'] ?? null,
        ]);

        $isPrimaryContact = ($payload['is_primary_contact'] ?? false) === true;

        if ($isPrimaryContact) {
            $membership->makeActivePrimaryContact();
            $membership->refresh();
        }

        $this->logMembershipActivity(
            membership: $membership,
            eventType: ActivityEventType::UnitMembershipCreated,
            summary: "{$resident->name} fue asignado a la unidad {$unit->label()}.",
            actor: $actor,
        );

        if ($isPrimaryContact) {
            $this->logMembershipActivity(
                membership: $membership,
                eventType: ActivityEventType::UnitMembershipPrimaryContactChanged,
                summary: "{$resident->name} quedo como contacto principal de la unidad {$unit->label()}.",
                actor: $actor,
                extraMetadata: [
                    'new_primary_membership_id' => $membership->id,
                ],
            );
        }

        return $membership;
    }

    /**
     * @param  array<int, string>  $changed
     * @param  array<string, mixed>  $extraMetadata
     */
    public function logMembershipActivity(UnitMembership $membership, ActivityEventType $eventType, string $summary, User $actor, array $changed = [], array $extraMetadata = []): void
    {
        $membership->loadMissing(['account', 'location', 'resident', 'unit']);

        $this->activityLogger->log(
            account: $membership->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'membership_id' => $membership->id,
                'resident_id' => $membership->resident_id,
                'resident_name' => $membership->resident->name,
                'unit_id' => $membership->unit_id,
                'unit_label' => $membership->unit->label(),
                'location_id' => $membership->location_id,
                'location_name' => $membership->location->name,
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'changed' => $changed,
                ...$extraMetadata,
            ],
            location: $membership->location,
            actor: $actor,
            subjectType: UnitMembership::class,
            subjectId: $membership->id,
        );
    }
}
