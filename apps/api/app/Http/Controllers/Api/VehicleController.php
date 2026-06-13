<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\VehicleType;
use App\Http\Controllers\Controller;
use App\Http\Resources\VehicleResource;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VehicleController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function index(Request $request, Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Vehicle::class, $location]);

        $validated = $this->validateList($request, $location);

        $vehicles = Vehicle::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->with('unit');

        $this->applyFilters($vehicles, $validated);
        $this->applySort($vehicles, $validated['sort'] ?? null);

        return VehicleResource::collection(
            $vehicles
                ->paginate((int) ($validated['per_page'] ?? 15))
                ->withQueryString()
        );
    }

    public function store(Request $request, Location $location): JsonResponse
    {
        Gate::authorize('create', [Vehicle::class, $location]);

        $validated = $this->validateVehiclePayload($request, $location);
        $unit = $this->managerUnitForPayload($validated['unit_id'], $location);

        /** @var User $actor */
        $actor = $request->user();

        $vehicle = DB::transaction(function () use ($validated, $location, $unit, $actor): Vehicle {
            $vehicle = Vehicle::query()->create([
                ...collect($validated)->only(['vehicle_type', 'plate', 'make', 'model', 'color', 'notes'])->all(),
                'account_id' => $location->account_id,
                'location_id' => $location->id,
                'unit_id' => $unit->id,
                'status' => RegistryStatus::Active,
            ]);

            $this->logVehicleActivity(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleCreated,
                summary: "Vehiculo {$this->vehicleLabel($vehicle)} creado para la unidad {$this->unitLabel($unit)}.",
                actor: $actor,
            );

            return $vehicle;
        });

        return (new VehicleResource($vehicle->load('unit')))->response()->setStatusCode(201);
    }

    public function show(Vehicle $vehicle): VehicleResource
    {
        Gate::authorize('view', $vehicle);

        return new VehicleResource($vehicle->load('unit'));
    }

    public function update(Request $request, Vehicle $vehicle): VehicleResource
    {
        Gate::authorize('update', $vehicle);

        $validated = $this->validateVehiclePayload($request, $vehicle->location, partial: true);

        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($validated, $vehicle, $actor): void {
            if (isset($validated['unit_id'])) {
                $unit = $this->managerUnitForPayload($validated['unit_id'], $vehicle->location);

                $vehicle->forceFill([
                    'account_id' => $unit->account_id,
                    'location_id' => $unit->location_id,
                    'unit_id' => $unit->id,
                ]);
            }

            $vehicle->fill(collect($validated)->except('unit_id')->all());

            if (! $vehicle->isDirty()) {
                return;
            }

            $changed = array_keys($vehicle->getDirty());
            $wasStatus = $vehicle->getOriginal('status');

            $vehicle->save();

            $eventType = $wasStatus !== RegistryStatus::Inactive->value && $vehicle->status === RegistryStatus::Inactive
                ? ActivityEventType::VehicleInactivated
                : ActivityEventType::VehicleUpdated;

            $this->logVehicleActivity(
                vehicle: $vehicle,
                eventType: $eventType,
                summary: $eventType === ActivityEventType::VehicleInactivated
                    ? "Vehiculo {$this->vehicleLabel($vehicle)} inactivado."
                    : "Vehiculo {$this->vehicleLabel($vehicle)} actualizado.",
                actor: $actor,
                changed: $changed,
            );
        });

        return new VehicleResource($vehicle->load('unit'));
    }

    public function destroy(Vehicle $vehicle): Response
    {
        Gate::authorize('delete', $vehicle);

        /** @var User $actor */
        $actor = request()->user();

        DB::transaction(function () use ($vehicle, $actor): void {
            $this->logVehicleActivity(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleDeleted,
                summary: "Vehiculo {$this->vehicleLabel($vehicle)} eliminado.",
                actor: $actor,
            );

            $vehicle->delete();
        });

        return response()->noContent();
    }

    public function portalIndex(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $unitIds = $this->portalUnitIds($user);

        abort_if($unitIds === [], 403);

        $vehicles = Vehicle::query()
            ->whereIn('unit_id', $unitIds)
            ->with('unit')
            ->orderBy('plate')
            ->orderBy('id');

        return VehicleResource::collection($vehicles->paginate(15));
    }

    public function portalStore(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $this->validatePortalVehiclePayload($request, $user);
        $unit = Unit::query()->findOrFail($validated['unit_id']);

        $vehicle = DB::transaction(function () use ($validated, $unit, $user): Vehicle {
            $vehicle = Vehicle::query()->create([
                ...collect($validated)->only(['vehicle_type', 'plate', 'make', 'model', 'color', 'notes'])->all(),
                'account_id' => $unit->account_id,
                'location_id' => $unit->location_id,
                'unit_id' => $unit->id,
                'status' => RegistryStatus::Active,
            ]);

            $this->logVehicleActivity(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleCreated,
                summary: "Vehiculo {$this->vehicleLabel($vehicle)} creado para la unidad {$this->unitLabel($unit)}.",
                actor: $user,
            );

            return $vehicle;
        });

        return (new VehicleResource($vehicle->load('unit')))->response()->setStatusCode(201);
    }

    public function portalUpdate(Request $request, Vehicle $vehicle): VehicleResource
    {
        /** @var User $user */
        $user = $request->user();

        Gate::authorize('update', $vehicle);

        $validated = $this->validatePortalVehiclePayload($request, $user, partial: true);

        DB::transaction(function () use ($validated, $vehicle, $user): void {
            if (isset($validated['unit_id'])) {
                $unit = Unit::query()->findOrFail($validated['unit_id']);

                $vehicle->forceFill([
                    'account_id' => $unit->account_id,
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

            $this->logVehicleActivity(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleUpdated,
                summary: "Vehiculo {$this->vehicleLabel($vehicle)} actualizado.",
                actor: $user,
                changed: $changed,
            );
        });

        return new VehicleResource($vehicle->load('unit'));
    }

    public function portalDestroy(Vehicle $vehicle): Response
    {
        Gate::authorize('delete', $vehicle);

        /** @var User $actor */
        $actor = request()->user();

        DB::transaction(function () use ($vehicle, $actor): void {
            $this->logVehicleActivity(
                vehicle: $vehicle,
                eventType: ActivityEventType::VehicleDeleted,
                summary: "Vehiculo {$this->vehicleLabel($vehicle)} eliminado.",
                actor: $actor,
            );

            $vehicle->delete();
        });

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateList(Request $request, Location $location): array
    {
        return $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'unit_id' => ['sometimes', 'nullable', 'string', 'ulid', Rule::exists('units', 'id')->where('account_id', $location->account_id)->where('location_id', $location->id)],
            'vehicle_type' => ['sometimes', 'nullable', Rule::enum(VehicleType::class)],
            'status' => ['sometimes', 'nullable', Rule::enum(RegistryStatus::class)],
            'plate' => ['sometimes', 'nullable', 'string', 'max:255'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'sort' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function applyFilters(Builder $vehicles, array $validated): void
    {
        $vehicles
            ->when($validated['unit_id'] ?? null, fn (Builder $query, string $unitId) => $query->where('unit_id', $unitId))
            ->when($validated['vehicle_type'] ?? null, fn (Builder $query, string $type) => $query->where('vehicle_type', $type))
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['plate'] ?? null, function (Builder $query, string $plate): void {
                $query->whereRaw('LOWER(plate) = ?', [Str::lower(trim($plate))]);
            })
            ->when($validated['search'] ?? null, function (Builder $query, string $search): void {
                $likeSearch = '%'.addcslashes(Str::lower(trim($search)), '\\%_').'%';

                $query->where(function (Builder $query) use ($likeSearch): void {
                    $query
                        ->whereRaw('LOWER(plate) LIKE ?', [$likeSearch])
                        ->orWhereRaw('LOWER(make) LIKE ?', [$likeSearch])
                        ->orWhereRaw('LOWER(model) LIKE ?', [$likeSearch])
                        ->orWhereRaw('LOWER(color) LIKE ?', [$likeSearch]);
                });
            });
    }

    private function applySort(Builder $vehicles, ?string $sort): void
    {
        $sort = $sort ?: 'plate';

        foreach (explode(',', $sort) as $sortPart) {
            $sortPart = trim($sortPart);

            if ($sortPart === '') {
                continue;
            }

            $descending = str_starts_with($sortPart, '-');
            $field = ltrim($sortPart, '-');
            $direction = $descending ? 'desc' : 'asc';

            match ($field) {
                'plate' => $vehicles->orderBy('plate', $direction),
                'vehicle_type' => $vehicles->orderBy('vehicle_type', $direction),
                'status' => $vehicles->orderBy('status', $direction),
                'created_at' => $vehicles->orderBy('created_at', $direction),
                default => null,
            };
        }

        $vehicles->orderBy('id');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateVehiclePayload(Request $request, Location $location, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'unit_id' => [$required, 'string', 'ulid', Rule::exists('units', 'id')->where('account_id', $location->account_id)->where('location_id', $location->id)],
            'vehicle_type' => [$required, Rule::enum(VehicleType::class)],
            'plate' => ['sometimes', 'nullable', 'string', 'max:255'],
            'make' => ['sometimes', 'nullable', 'string', 'max:255'],
            'model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'color' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::enum(RegistryStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);
    }

    private function managerUnitForPayload(string $unitId, Location $location): Unit
    {
        $unit = Unit::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->find($unitId);

        if (! $unit || $unit->status !== RegistryStatus::Active) {
            throw ValidationException::withMessages([
                'unit_id' => __('The selected unit is not available for vehicle assignment.'),
            ]);
        }

        return $unit;
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePortalVehiclePayload(Request $request, User $user, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $validated = $request->validate([
            'unit_id' => [$required, 'string', 'ulid', Rule::exists('units', 'id')],
            'vehicle_type' => [$required, Rule::enum(VehicleType::class)],
            'plate' => ['sometimes', 'nullable', 'string', 'max:255'],
            'make' => ['sometimes', 'nullable', 'string', 'max:255'],
            'model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'color' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['prohibited'],
        ]);

        if (isset($validated['unit_id']) && ! in_array($validated['unit_id'], $this->portalUnitIds($user), true)) {
            throw ValidationException::withMessages([
                'unit_id' => __('The selected unit is not available for vehicle assignment.'),
            ]);
        }

        return $validated;
    }

    /**
     * @return array<int, string>
     */
    private function portalUnitIds(User $user): array
    {
        return $this->access
            ->activeResidentMembershipsForUser($user)
            ->pluck('unit_id')
            ->all();
    }

    /**
     * @param  array<int, string>  $changed
     */
    private function logVehicleActivity(Vehicle $vehicle, ActivityEventType $eventType, string $summary, User $actor, array $changed = []): void
    {
        $vehicle->loadMissing(['account', 'location', 'unit']);

        $this->activityLogger->log(
            account: $vehicle->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'vehicle_id' => $vehicle->id,
                'vehicle_label' => $this->vehicleLabel($vehicle),
                'plate' => $vehicle->plate,
                'unit_id' => $vehicle->unit_id,
                'unit_label' => $this->unitLabel($vehicle->unit),
                'location_id' => $vehicle->location_id,
                'location_name' => $vehicle->location->name,
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'changed' => $changed,
            ],
            location: $vehicle->location,
            actor: $actor,
            subjectType: Vehicle::class,
            subjectId: $vehicle->id,
        );
    }

    private function vehicleLabel(Vehicle $vehicle): string
    {
        return $vehicle->plate ?: $vehicle->vehicle_type->value;
    }

    private function unitLabel(Unit $unit): string
    {
        return trim(collect([$unit->building_name, $unit->unit_number])->filter()->implode(' / '));
    }
}
