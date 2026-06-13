<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUnitRequest;
use App\Http\Requests\UpdateUnitRequest;
use App\Http\Resources\UnitResource;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
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

class UnitController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function index(Request $request, Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Unit::class, $location]);

        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::enum(RegistryStatus::class)],
            'sort' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $status = $validated['status'] ?? RegistryStatus::Active->value;

        $units = Unit::query()
            ->where('account_id', $location->account_id)
            ->where('location_id', $location->id)
            ->when($status, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['search'] ?? null, function (Builder $query, string $search): void {
                $likeSearch = '%'.addcslashes(Str::lower(trim($search)), '\\%_').'%';

                $query->where(function (Builder $query) use ($likeSearch): void {
                    $query
                        ->whereRaw('LOWER(unit_number) LIKE ?', [$likeSearch])
                        ->orWhereRaw('LOWER(building_name) LIKE ?', [$likeSearch]);
                });
            })
            ->with(Unit::summaryRelations())
            ->withCount(Unit::summaryCounts());

        $this->applySort($units, $validated['sort'] ?? null);

        return UnitResource::collection(
            $units
                ->paginate((int) ($validated['per_page'] ?? 15))
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
                ...$request->safe()->only(['unit_number', 'building_name', 'floor', 'notes']),
                'account_id' => $location->account_id,
                'location_id' => $location->id,
                'status' => RegistryStatus::Active,
            ]);

            $this->logUnitActivity(
                unit: $unit,
                eventType: ActivityEventType::UnitCreated,
                summary: "Unidad {$this->unitLabel($unit)} creada.",
                actor: $actor,
            );

            return $unit;
        });

        return (new UnitResource($unit->loadSummary()))->response()->setStatusCode(201);
    }

    public function show(Unit $unit): UnitResource
    {
        Gate::authorize('view', $unit);

        return new UnitResource($unit->loadSummary());
    }

    public function update(UpdateUnitRequest $request, Unit $unit): UnitResource
    {
        Gate::authorize('update', $unit);

        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($request, $unit, $actor): void {
            $unit->fill($request->safe()->only([
                'unit_number',
                'building_name',
                'floor',
                'status',
                'notes',
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
                    ? "Unidad {$this->unitLabel($unit)} inactivada."
                    : "Unidad {$this->unitLabel($unit)} actualizada.",
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
                summary: "Unidad {$this->unitLabel($unit)} inactivada.",
                actor: $actor,
                changed: ['status'],
            );
        });

        return new UnitResource($unit->loadSummary());
    }

    /**
     * @param  Builder<Unit>  $query
     */
    private function applySort(Builder $query, ?string $sort): void
    {
        $sort = $sort ?: 'building_name,floor,unit_number';

        foreach (explode(',', $sort) as $sortPart) {
            $sortPart = trim($sortPart);

            if ($sortPart === '') {
                continue;
            }

            $descending = str_starts_with($sortPart, '-');
            $field = ltrim($sortPart, '-');
            $direction = $descending ? 'desc' : 'asc';

            match ($field) {
                'building_name' => $query->orderBy('building_name', $direction),
                'floor' => $query->orderByRaw("NULLIF(regexp_replace(floor, '[^0-9]', '', 'g'), '')::int {$direction} NULLS LAST")->orderBy('floor', $direction),
                'unit_number' => $query->orderBy('unit_number', $direction),
                'status' => $query->orderBy('status', $direction),
                'resident_count' => $query->orderBy('active_unit_memberships_count', $direction),
                'created_at' => $query->orderBy('created_at', $direction),
                default => null,
            };
        }

        $query->orderBy('id');
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
                'unit_label' => $this->unitLabel($unit),
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

    private function unitLabel(Unit $unit): string
    {
        return trim(collect([$unit->building_name, $unit->unit_number])->filter()->implode(' / '));
    }
}
