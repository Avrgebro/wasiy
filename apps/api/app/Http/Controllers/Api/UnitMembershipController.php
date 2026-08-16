<?php

namespace App\Http\Controllers\Api;

use App\Actions\Registry\CreateUnitMembership;
use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUnitMembershipRequest;
use App\Http\Requests\UpdateUnitMembershipRequest;
use App\Http\Resources\UnitMembershipResource;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class UnitMembershipController extends Controller
{
    public function __construct(
        private readonly CreateUnitMembership $createMembership,
    ) {}

    public function store(StoreUnitMembershipRequest $request, Resident $resident): JsonResponse
    {
        $validated = $request->validated();
        $unit = $request->unit();

        Gate::authorize('create', [UnitMembership::class, $unit->location]);

        /** @var User $actor */
        $actor = $request->user();

        $membership = DB::transaction(fn (): UnitMembership => $this->createMembership->handle($resident, $unit, $validated, $actor));

        return (new UnitMembershipResource($membership->loadSummary()))->response()->setStatusCode(201);
    }

    public function update(UpdateUnitMembershipRequest $request, UnitMembership $membership): UnitMembershipResource
    {
        $validated = $request->validated();

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

                $this->createMembership->logMembershipActivity(
                    membership: $membership,
                    eventType: $eventType,
                    summary: $eventType === ActivityEventType::UnitMembershipInactivated
                        ? "{$membership->resident->name} fue inactivado en la unidad {$membership->unit->label()}."
                        : "Membresia de {$membership->resident->name} actualizada para la unidad {$membership->unit->label()}.",
                    actor: $actor,
                    changed: $dirtyBeforePrimary,
                );
            }

            if (($validated['is_primary_contact'] ?? false) === true && ! $membership->is_primary_contact) {
                $membership->markAsPrimaryContact();
                $membership->refresh();

                $this->createMembership->logMembershipActivity(
                    membership: $membership,
                    eventType: ActivityEventType::UnitMembershipPrimaryContactChanged,
                    summary: "{$membership->resident->name} quedo como contacto principal de la unidad {$membership->unit->label()}.",
                    actor: $actor,
                    extraMetadata: [
                        'new_primary_membership_id' => $membership->id,
                    ],
                );
            } elseif (array_key_exists('is_primary_contact', $validated) && $validated['is_primary_contact'] === false && $membership->is_primary_contact) {
                $membership->forceFill(['is_primary_contact' => false])->save();

                $this->createMembership->logMembershipActivity(
                    membership: $membership,
                    eventType: ActivityEventType::UnitMembershipUpdated,
                    summary: "Membresia de {$membership->resident->name} actualizada para la unidad {$membership->unit->label()}.",
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

            $this->createMembership->logMembershipActivity(
                membership: $membership,
                eventType: ActivityEventType::UnitMembershipInactivated,
                summary: "{$membership->resident->name} fue inactivado en la unidad {$membership->unit->label()}.",
                actor: $actor,
                changed: ['status', 'is_primary_contact', 'ended_at'],
            );
        });

        return new UnitMembershipResource($membership->loadSummary());
    }
}
