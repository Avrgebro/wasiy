<?php

namespace App\Http\Controllers\Api;

use App\Actions\Registry\VehicleWriter;
use App\Enums\ActivityEventType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePortalVehicleRequest;
use App\Http\Requests\UpdatePortalVehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Unit;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\AccessAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Resident-facing vehicle CRUD. Residents may only touch vehicles in units
 * where they hold an active membership, and can never set a vehicle's
 * status — that ability is staff-only (VehicleController). Reassignment is
 * limited to the resident's own units, which may span locations within
 * their account.
 */
class PortalVehicleController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly VehicleWriter $vehicles,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate($this->paginationRules());

        /** @var User $user */
        $user = $request->user();
        $unitIds = $this->unitIdsFor($user);

        abort_if($unitIds === [], 403);

        $vehicles = Vehicle::query()
            ->whereIn('unit_id', $unitIds)
            ->with('unit')
            ->orderBy('plate')
            ->orderBy('id');

        return VehicleResource::collection(
            $vehicles
                ->paginate($this->perPage($validated))
                ->withQueryString()
        );
    }

    public function store(StorePortalVehicleRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();
        $unit = $request->unit();

        Gate::authorize('createAsResident', [Vehicle::class, $unit]);

        $vehicle = $this->vehicles->create($unit, $validated, $user);

        return (new VehicleResource($vehicle->load('unit')))->response()->setStatusCode(201);
    }

    public function update(UpdatePortalVehicleRequest $request, Vehicle $vehicle): VehicleResource
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $vehicle, $user): void {
            if (isset($validated['unit_id'])) {
                $unit = Unit::query()->findOrFail($validated['unit_id']);

                // Memberships are pinned to the resident's account, so only
                // the location can legitimately change with the unit.
                $vehicle->forceFill([
                    'location_id' => $unit->location_id,
                    'unit_id' => $unit->id,
                ]);
            }

            $vehicle->fill(collect($validated)->except('unit_id')->all());

            if (! $vehicle->isDirty()) {
                return;
            }

            $changed = array_keys($vehicle->getDirty());

            $vehicle->save();

            $this->vehicles->log(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleUpdated,
                summary: "Vehiculo {$vehicle->label()} actualizado.",
                actor: $user,
                changed: $changed,
            );
        });

        return new VehicleResource($vehicle->load('unit'));
    }

    public function destroy(Vehicle $vehicle): Response
    {
        Gate::authorize('deleteAsResident', $vehicle);

        /** @var User $actor */
        $actor = request()->user();

        DB::transaction(function () use ($vehicle, $actor): void {
            $this->vehicles->log(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleDeleted,
                summary: "Vehiculo {$vehicle->label()} eliminado.",
                actor: $actor,
            );

            $vehicle->delete();
        });

        return response()->noContent();
    }

    /**
     * @return array<int, string>
     */
    private function unitIdsFor(User $user): array
    {
        return $this->access
            ->activeResidentMembershipsForUser($user)
            ->pluck('unit_id')
            ->all();
    }
}
