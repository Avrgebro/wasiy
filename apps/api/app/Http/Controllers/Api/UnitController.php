<?php

namespace App\Http\Controllers\Api;

use App\Actions\Units\DeactivateUnit;
use App\Enums\ActivityEventType;
use App\Enums\Capability;
use App\Enums\RegistryStatus;
use App\Enums\UnitType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUnitRequest;
use App\Http\Requests\UpdateUnitRequest;
use App\Http\Resources\FinancialMovementResource;
use App\Http\Resources\PackageResource;
use App\Http\Resources\ReservationResource;
use App\Http\Resources\UnitResource;
use App\Http\Resources\VisitResource;
use App\Models\ActivityLog;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Package;
use App\Models\Reservation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Visit;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use App\Support\SortParser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UnitController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly AccessAuthorizationService $access,
    ) {}

    public function index(Request $request, Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Unit::class, $location]);

        $validated = $request->validate([
            ...$this->paginationRules(),
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::enum(RegistryStatus::class)],
            'occupancy' => ['sometimes', 'nullable', Rule::in(['occupied', 'vacant', 'attention'])],
            'portal' => ['sometimes', 'nullable', Rule::in(['active', 'invited', 'not_invited', 'none'])],
            'fee' => ['sometimes', 'nullable', Rule::in(['missing'])],
            'type' => ['sometimes', 'nullable', Rule::enum(UnitType::class)],
            'sort' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $status = $validated['status'] ?? RegistryStatus::Active->value;

        $units = Unit::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->when($status, fn (Builder $query, string $status) => $query->where('status', $status))
            // One box finds a home by number, by who lives there, or by plate.
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->where(fn (Builder $group) => $group
                ->searchLike(['unit_number', 'building_name'], $search)
                ->orWhereHas('activeUnitMemberships.resident', fn (Builder $resident) => $resident
                    ->searchLike(["CONCAT(first_name, ' ', last_name)"], $search))
                ->orWhereHas('vehicles', fn (Builder $vehicle) => $vehicle->searchLike(['plate'], $search))))
            ->when($validated['type'] ?? null, fn (Builder $query, string $type) => $query->where('type', $type))
            ->when(($validated['fee'] ?? null) === 'missing', fn (Builder $query) => $query->whereNull('maintenance_fee'))
            ->when($validated['occupancy'] ?? null, fn (Builder $query, string $occupancy) => match ($occupancy) {
                'occupied' => $query->whereHas('activeUnitMemberships'),
                'vacant' => $query->whereDoesntHave('activeUnitMemberships'),
                default => $query->whereHas('activeUnitMemberships')->whereDoesntHave('primaryContactMembership'),
            })
            ->when($validated['portal'] ?? null, fn (Builder $query, string $portal) => match ($portal) {
                'active' => $query->whereHas('portalMemberships'),
                'invited' => $query->whereDoesntHave('portalMemberships')->whereHas('invitedMemberships'),
                // "Sin portal": residents, but nobody in and nobody invited.
                default => $query->whereHas('activeUnitMemberships')->whereDoesntHave('portalMemberships')->whereDoesntHave('invitedMemberships'),
            })
            ->with(Unit::summaryRelations())
            ->withCount(Unit::summaryCounts());

        SortParser::apply($units, $validated['sort'] ?? null, [
            'building_name' => 'building_name',
            'floor' => fn (Builder $query, string $direction) => $query
                ->orderByRaw("NULLIF(regexp_replace(floor, '[^0-9]', '', 'g'), '')::int {$direction} NULLS LAST")
                ->orderBy('floor', $direction),
            'unit_number' => 'unit_number',
            'status' => 'status',
            'maintenance_fee' => 'maintenance_fee',
            'resident_count' => 'active_unit_memberships_count',
            'created_at' => 'created_at',
        ], default: 'building_name,floor,unit_number');

        return UnitResource::collection(
            $units
                ->paginate($this->perPage($validated))
                ->withQueryString()
        );
    }

    public function store(StoreUnitRequest $request, Location $location): JsonResponse
    {
        Gate::authorize('create', [Unit::class, $location]);

        /** @var User $actor */
        $actor = $request->user();

        $unit = DB::transaction(function () use ($request, $location, $actor): Unit {
            $unit = Unit::query()->create([
                ...$request->safe()->only(['unit_number', 'type', 'building_name', 'floor', 'area_m2', 'participation_share', 'maintenance_fee', 'parking_spots', 'storage_rooms', 'notes']),
                'account_id' => $location->account_id,
                'location_id' => $location->id,
                'type' => $request->safe()->enum('type', UnitType::class) ?? UnitType::Apartment,
                'status' => RegistryStatus::Active,
            ]);

            $this->logUnitActivity(
                unit: $unit,
                eventType: ActivityEventType::UnitCreated,
                summary: "Unidad {$unit->label()} creada.",
                actor: $actor,
            );

            return $unit;
        });

        return (new UnitResource($unit->loadSummary()))->response()->setStatusCode(201);
    }

    /**
     * The detail page (mockup 12): the unit with its people and vehicles,
     * plus the sections that read other modules — upcoming bookings, this
     * month's charges and the pending balance, and the internal notes.
     */
    public function show(Request $request, Unit $unit): UnitResource
    {
        Gate::authorize('view', $unit);

        $unit->loadSummary()->load([
            'activeUnitMemberships.resident.userInvitations',
            'vehicles' => fn ($query) => $query->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")->orderBy('plate'),
        ]);

        $timezone = $unit->location->timezone;
        $month = CarbonImmutable::now($timezone)->format('Y-m');

        $reservations = Reservation::query()
            ->where('unit_id', $unit->id)
            ->whereIn('status', ['pending', 'observed', 'approved'])
            ->where('ends_at', '>', now())
            ->with(['amenity', 'resident'])
            ->orderBy('starts_at')
            ->limit(5)
            ->get();

        // The ledger sections are for managers; the desk gets the unit
        // without them (ADR 0036), so the keys are absent, not empty.
        $seesFinances = $this->access->can($request->user(), $unit->location, Capability::ManageFinances);

        $movements = $seesFinances
            ? FinancialMovement::query()
                ->where('unit_id', $unit->id)
                ->inMonth($month)
                ->orderByDesc('occurred_on')->orderByDesc('created_at')
                ->get()
            : null;

        $pendingBalance = $seesFinances
            ? (int) FinancialMovement::query()
                ->where('unit_id', $unit->id)
                ->where('direction', 'income')
                ->where('status', 'pending')
                ->sum('amount')
            : null;

        $notes = ActivityLog::query()
            ->where('subject_type', Unit::class)
            ->where('subject_id', $unit->id)
            ->where('event_type', ActivityEventType::UnitNoteAdded->value)
            ->with('actor')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'body' => $entry->metadata['body'] ?? '',
                'author_name' => $entry->actor?->name,
                'created_at' => $entry->created_at?->toJSON(),
            ])
            ->all();

        $packages = Package::query()
            ->where('unit_id', $unit->id)
            ->where('status', 'pending')
            ->with(['resident', 'receivedBy'])
            ->orderByDesc('received_at')
            ->get();

        $visits = Visit::query()
            ->where('unit_id', $unit->id)
            ->with(['resident', 'checkedInBy'])
            ->orderByDesc('checked_in_at')
            ->limit(5)
            ->get();

        return (new UnitResource($unit))->additional(array_filter([
            'visits' => VisitResource::collection($visits)->resolve(),
            'packages' => PackageResource::collection($packages)->resolve(),
            'reservations' => ReservationResource::collection($reservations)->resolve(),
            'movements' => $movements !== null ? FinancialMovementResource::collection($movements)->resolve() : null,
            'movements_month' => $seesFinances ? $month : null,
            'pending_balance' => $pendingBalance,
            'notes' => $notes,
        ], fn ($value): bool => $value !== null));
    }

    public function storeNote(Request $request, Unit $unit): JsonResponse
    {
        Gate::authorize('update', $unit);

        $validated = $request->validate(['body' => ['required', 'string', 'max:2000']]);

        /** @var User $actor */
        $actor = $request->user();

        $entry = $this->activityLogger->log(
            account: $unit->account,
            eventType: ActivityEventType::UnitNoteAdded,
            summary: "Nota interna en la unidad {$unit->label()}.",
            metadata: ['unit_id' => $unit->id, 'unit_label' => $unit->label(), 'body' => $validated['body']],
            location: $unit->location,
            actor: $actor,
            subjectType: Unit::class,
            subjectId: $unit->id,
        );

        return response()->json(['data' => [
            'id' => $entry->id,
            'body' => $validated['body'],
            'author_name' => $actor->name,
            'created_at' => $entry->created_at?->toJSON(),
        ]], 201);
    }

    public function deactivate(Request $request, Unit $unit, DeactivateUnit $deactivate): UnitResource
    {
        Gate::authorize('update', $unit);

        /** @var User $actor */
        $actor = $request->user();

        return new UnitResource($deactivate->handle($unit, $actor)->loadSummary());
    }

    public function reactivate(Request $request, Unit $unit, DeactivateUnit $deactivate): UnitResource
    {
        Gate::authorize('update', $unit);

        /** @var User $actor */
        $actor = $request->user();

        return new UnitResource($deactivate->reactivate($unit, $actor)->loadSummary());
    }

    public function update(UpdateUnitRequest $request, Unit $unit): UnitResource
    {
        Gate::authorize('update', $unit);

        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($request, $unit, $actor): void {
            $unit->fill($request->safe()->only([
                'unit_number', 'type', 'building_name', 'floor', 'area_m2', 'participation_share',
                'maintenance_fee', 'parking_spots', 'storage_rooms', 'status', 'notes',
            ]));

            if (! $unit->isDirty()) {
                return;
            }

            $changed = array_keys($unit->getDirty());
            $wasStatus = $unit->getOriginal('status');

            $unit->save();

            $eventType = $wasStatus !== RegistryStatus::Inactive->value && $unit->status === RegistryStatus::Inactive
                ? ActivityEventType::UnitInactivated
                : ActivityEventType::UnitUpdated;

            $this->logUnitActivity(
                unit: $unit,
                eventType: $eventType,
                summary: $eventType === ActivityEventType::UnitInactivated
                    ? "Unidad {$unit->label()} inactivada."
                    : "Unidad {$unit->label()} actualizada.",
                actor: $actor,
                changed: $changed,
            );
        });

        return new UnitResource($unit->loadSummary());
    }

    public function destroy(Unit $unit): UnitResource|Response
    {
        Gate::authorize('delete', $unit);

        if (! $unit->unitMemberships()->exists() && ! $unit->vehicles()->exists()) {
            $unit->delete();

            return response()->noContent();
        }

        /** @var User $actor */
        $actor = request()->user();

        DB::transaction(function () use ($unit, $actor): void {
            $unit->forceFill([
                'status' => RegistryStatus::Inactive,
            ])->save();

            $this->logUnitActivity(
                unit: $unit,
                eventType: ActivityEventType::UnitInactivated,
                summary: "Unidad {$unit->label()} inactivada.",
                actor: $actor,
                changed: ['status'],
            );
        });

        return new UnitResource($unit->loadSummary());
    }

    /**
     * @param  array<int, string>  $changed
     */
    private function logUnitActivity(Unit $unit, ActivityEventType $eventType, string $summary, User $actor, array $changed = []): void
    {
        $this->activityLogger->log(
            account: $unit->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'unit_id' => $unit->id,
                'unit_label' => $unit->label(),
                'location_id' => $unit->location_id,
                'location_name' => $unit->location->name,
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'changed' => $changed,
            ],
            location: $unit->location,
            actor: $actor,
            subjectType: Unit::class,
            subjectId: $unit->id,
        );
    }
}
