<?php

namespace App\Http\Controllers\Api;

use App\Actions\Registry\VehicleWriter;
use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\VehicleType;
use App\Http\Controllers\Controller;
use App\Http\Resources\VehicleResource;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\SortParser;
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
        private readonly VehicleWriter $vehicles,
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
        SortParser::apply($vehicles, $validated['sort'] ?? null, [
            'plate' => 'plate',
            'vehicle_type' => 'vehicle_type',
            'status' => 'status',
            'created_at' => 'created_at',
        ], default: 'plate');

        return VehicleResource::collection(
            $vehicles
                ->paginate($this->perPage($validated))
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

        $vehicle = $this->vehicles->create($unit, $validated, $actor);

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
                // The validator pins the unit to the vehicle's current
                // account and location, so only the assignment can change.
                $unit = $this->managerUnitForPayload($validated['unit_id'], $vehicle->location);
                $vehicle->unit_id = $unit->id;
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

            $this->vehicles->log(
                vehicle: $vehicle,
                eventType: $eventType,
                summary: $eventType === ActivityEventType::VehicleInactivated
                    ? "Vehiculo {$vehicle->label()} inactivado."
                    : "Vehiculo {$vehicle->label()} actualizado.",
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
     * @return array<string, mixed>
     */
    private function validateList(Request $request, Location $location): array
    {
        return $request->validate([
            ...$this->paginationRules(),
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
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->searchLike(['plate', 'make', 'model', 'color'], $search));
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
}
