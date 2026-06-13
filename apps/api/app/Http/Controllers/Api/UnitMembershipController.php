<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Http\Controllers\Controller;
use App\Http\Resources\UnitMembershipResource;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UnitMembershipController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function store(Request $request, Resident $resident): JsonResponse
    {
        $validated = $this->validatePayload($request, $resident);
        $unit = Unit::query()->where('account_id', $resident->account_id)->findOrFail($validated['unit_id']);

        Gate::authorize('create', [UnitMembership::class, $unit->location]);

        /** @var User $actor */
        $actor = $request->user();

        $membership = DB::transaction(function () use ($resident, $unit, $validated, $actor): UnitMembership {
            $membership = $resident->unitMemberships()->create([
                'account_id' => $resident->account_id,
                'location_id' => $unit->location_id,
                'unit_id' => $unit->id,
                'resident_type' => $validated['resident_type'],
                'status' => $validated['status'] ?? RegistryStatus::Active,
                'is_primary_contact' => false,
                'started_at' => $validated['started_at'] ?? null,
                'ended_at' => $validated['ended_at'] ?? null,
            ]);

            if (($validated['is_primary_contact'] ?? false) === true) {
                $membership->markAsPrimaryContact();
                $membership->refresh();
            }

            $this->logMembershipActivity(
                membership: $membership,
                eventType: ActivityEventType::UnitMembershipCreated,
                summary: "{$resident->name} fue asignado a la unidad {$this->unitLabel($unit)}.",
                actor: $actor,
            );

            if (($validated['is_primary_contact'] ?? false) === true) {
                $this->logMembershipActivity(
                    membership: $membership,
                    eventType: ActivityEventType::UnitMembershipPrimaryContactChanged,
                    summary: "{$resident->name} quedo como contacto principal de la unidad {$this->unitLabel($unit)}.",
                    actor: $actor,
                    extraMetadata: [
                        'new_primary_membership_id' => $membership->id,
                    ],
                );
            }

            return $membership;
        });

        return (new UnitMembershipResource($membership->loadSummary()))->response()->setStatusCode(201);
    }

    public function update(Request $request, UnitMembership $membership): UnitMembershipResource
    {
        Gate::authorize('update', $membership);

        $validated = $this->validatePayload($request, $membership->resident, partial: true);

        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($validated, $membership, $actor): void {
            if (isset($validated['unit_id'])) {
                $unit = Unit::query()->where('account_id', $membership->account_id)->findOrFail($validated['unit_id']);
                Gate::authorize('create', [UnitMembership::class, $unit->location]);
                $membership->forceFill([
                    'location_id' => $unit->location_id,
                    'unit_id' => $unit->id,
                ]);
            }

            $membership->fill(collect($validated)->except(['unit_id', 'is_primary_contact'])->all());

            if (($validated['status'] ?? null) === RegistryStatus::Inactive->value) {
                $membership->is_primary_contact = false;
            }

            $dirtyBeforePrimary = array_keys($membership->getDirty());

            if ($dirtyBeforePrimary !== []) {
                $membership->save();

                $eventType = in_array('status', $dirtyBeforePrimary, true) && $membership->status === RegistryStatus::Inactive
                    ? ActivityEventType::UnitMembershipInactivated
                    : ActivityEventType::UnitMembershipUpdated;

                $this->logMembershipActivity(
                    membership: $membership,
                    eventType: $eventType,
                    summary: $eventType === ActivityEventType::UnitMembershipInactivated
                        ? "{$membership->resident->name} fue inactivado en la unidad {$this->unitLabel($membership->unit)}."
                        : "Membresia de {$membership->resident->name} actualizada para la unidad {$this->unitLabel($membership->unit)}.",
                    actor: $actor,
                    changed: $dirtyBeforePrimary,
                );
            }

            if (($validated['is_primary_contact'] ?? false) === true && ! $membership->is_primary_contact) {
                $membership->markAsPrimaryContact();
                $membership->refresh();

                $this->logMembershipActivity(
                    membership: $membership,
                    eventType: ActivityEventType::UnitMembershipPrimaryContactChanged,
                    summary: "{$membership->resident->name} quedo como contacto principal de la unidad {$this->unitLabel($membership->unit)}.",
                    actor: $actor,
                    extraMetadata: [
                        'new_primary_membership_id' => $membership->id,
                    ],
                );
            } elseif (array_key_exists('is_primary_contact', $validated) && $validated['is_primary_contact'] === false && $membership->is_primary_contact) {
                $membership->forceFill(['is_primary_contact' => false])->save();

                $this->logMembershipActivity(
                    membership: $membership,
                    eventType: ActivityEventType::UnitMembershipUpdated,
                    summary: "Membresia de {$membership->resident->name} actualizada para la unidad {$this->unitLabel($membership->unit)}.",
                    actor: $actor,
                    changed: ['is_primary_contact'],
                );
            }
        });

        return new UnitMembershipResource($membership->loadSummary());
    }

    public function destroy(UnitMembership $membership): UnitMembershipResource
    {
        Gate::authorize('delete', $membership);

        /** @var User $actor */
        $actor = request()->user();

        DB::transaction(function () use ($membership, $actor): void {
            $membership->forceFill([
                'status' => RegistryStatus::Inactive,
                'is_primary_contact' => false,
                'ended_at' => $membership->ended_at ?? now()->toDateString(),
            ])->save();

            $this->logMembershipActivity(
                membership: $membership,
                eventType: ActivityEventType::UnitMembershipInactivated,
                summary: "{$membership->resident->name} fue inactivado en la unidad {$this->unitLabel($membership->unit)}.",
                actor: $actor,
                changed: ['status', 'is_primary_contact', 'ended_at'],
            );
        });

        return new UnitMembershipResource($membership->loadSummary());
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, Resident $resident, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $validated = $request->validate([
            'unit_id' => [$required, 'string', 'ulid', Rule::exists('units', 'id')->where('account_id', $resident->account_id)],
            'resident_type' => [$required, Rule::enum(ResidentType::class)],
            'status' => ['sometimes', Rule::enum(RegistryStatus::class)],
            'is_primary_contact' => ['sometimes', 'boolean'],
            'started_at' => ['sometimes', 'nullable', 'date'],
            'ended_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (isset($validated['unit_id'])) {
            $unit = Unit::query()->find($validated['unit_id']);

            if (! $unit || ! Gate::allows('create', [UnitMembership::class, $unit->location])) {
                throw ValidationException::withMessages([
                    'unit_id' => __('The selected unit is not available for membership assignment.'),
                ]);
            }
        }

        return $validated;
    }

    /**
     * @param  array<int, string>  $changed
     * @param  array<string, mixed>  $extraMetadata
     */
    private function logMembershipActivity(UnitMembership $membership, ActivityEventType $eventType, string $summary, User $actor, array $changed = [], array $extraMetadata = []): void
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
                'unit_label' => $this->unitLabel($membership->unit),
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

    private function unitLabel(Unit $unit): string
    {
        return trim(collect([$unit->building_name, $unit->unit_number])->filter()->implode(' / '));
    }
}
