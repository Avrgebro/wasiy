<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityEventType;
use App\Http\Controllers\Controller;
use App\Http\Resources\BuildingResource;
use App\Models\Building;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * A Location's towers (ADR 0037). The list drives the unit form: one
 * building means no tower field; two or more mean a required select. The
 * last building is never deleted and a building with units is never deleted;
 * a rename is one row because units point at the id.
 */
class BuildingController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function index(Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Building::class, $location]);

        return BuildingResource::collection(
            $location->buildings()->withCount('units')->get(),
        );
    }

    public function store(Request $request, Location $location): JsonResponse
    {
        Gate::authorize('create', [Building::class, $location]);
        $validated = $request->validate($this->rules($location));

        $building = $location->buildings()->create([
            'account_id' => $location->account_id,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ((int) $location->buildings()->max('sort_order')) + 1,
        ]);

        $this->log($location, $request->user(), "Se agregó la torre {$building->name}.", $building);

        return (new BuildingResource($building->loadCount('units')))->response()->setStatusCode(201);
    }

    public function update(Request $request, Building $building): JsonResource
    {
        Gate::authorize('update', $building);
        $location = $building->location;
        $validated = $request->validate($this->rules($location, $building));

        $before = $building->name;
        $building->fill(collect($validated)->only(['name', 'code', 'sort_order'])->all())->save();

        if ($before !== $building->name) {
            $this->log($location, $request->user(), 'Se renombró la torre '.($before ?? '(principal)')." a {$building->name}.", $building);
        }

        return new BuildingResource($building->loadCount('units'));
    }

    public function destroy(Request $request, Building $building): JsonResponse
    {
        Gate::authorize('delete', $building);
        $location = $building->location;

        abort_if($location->buildings()->count() <= 1, 422, __('A location keeps at least one building.'));
        $units = $building->units()->count();
        abort_if($units > 0, 422, trans_choice('{1} :count unit still lives in this building. Move it first.|[2,*] :count units still live in this building. Move them first.', $units, ['count' => $units]));

        $building->delete();
        $this->log($location, $request->user(), "Se eliminó la torre {$building->name}.", $building);

        return response()->json(['data' => ['id' => $building->id]]);
    }

    /**
     * Once a Location has more than one Building, every Building needs a
     * name: that is what puts the tower on unit labels.
     *
     * @return array<string, array<int, mixed>>
     */
    private function rules(Location $location, ?Building $building = null): array
    {
        $others = $location->buildings()->when($building, fn ($query) => $query->whereKeyNot($building->id));
        $nameRequired = $building === null || $others->count() >= 1;

        return [
            'name' => [
                $nameRequired ? 'required' : 'nullable',
                'string',
                'max:80',
                // Case-insensitive, like the index: "torre b" is "Torre B".
                function (string $attribute, mixed $value, callable $fail) use ($location, $building): void {
                    if (is_string($value) && $location->buildings()
                        ->when($building, fn ($query) => $query->whereKeyNot($building->id))
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($value))])
                        ->exists()) {
                        $fail(__('This location already has a building with that name.'));
                    }
                },
            ],
            'code' => ['sometimes', 'nullable', 'string', 'max:8'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ];
    }

    private function log(Location $location, ?User $actor, string $summary, Building $building): void
    {
        $this->activityLogger->log(
            account: $location->account,
            eventType: ActivityEventType::LocationBuildingsChanged,
            summary: $summary,
            metadata: ['building_id' => $building->id, 'building_name' => $building->name],
            location: $location,
            actor: $actor,
            subjectType: 'location',
            subjectId: $location->id,
        );
    }
}
