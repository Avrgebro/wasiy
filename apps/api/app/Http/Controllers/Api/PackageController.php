<?php

namespace App\Http\Controllers\Api;

use App\Actions\Packages\DeliverPackage;
use App\Actions\Packages\RegisterPackage;
use App\Enums\PackageStatus;
use App\Enums\RegistryStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PackageResource;
use App\Models\Location;
use App\Models\Package;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PackageController extends Controller
{
    private const RELATIONS = ['unit', 'resident', 'receivedBy', 'deliveredBy'];

    public function index(Request $request, Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Package::class, $location]);

        $validated = $request->validate([
            ...$this->paginationRules(),
            'status' => ['sometimes', 'nullable', Rule::enum(PackageStatus::class)],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $packages = Package::query()
            ->where('location_id', $location->id)
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->where(fn (Builder $group) => $group
                ->whereHas('unit', fn (Builder $unit) => $unit->searchLike(['unit_number', 'building_name'], $search))
                ->orWhereHas('resident', fn (Builder $resident) => $resident->searchLike(["CONCAT(first_name, ' ', last_name)"], $search))))
            ->with(self::RELATIONS)
            ->orderByDesc('received_at')
            ->orderByDesc('id');

        return PackageResource::collection($packages->paginate($this->perPage($validated))->withQueryString());
    }

    public function store(Request $request, Location $location, RegisterPackage $register): JsonResponse
    {
        Gate::authorize('create', [Package::class, $location]);

        $validated = $request->validate([
            'unit_id' => ['required', 'string', 'ulid'],
            'resident_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $unit = Unit::query()
            ->where('location_id', $location->id)
            ->where('status', RegistryStatus::Active->value)
            ->find($validated['unit_id']);
        if ($unit === null) {
            throw ValidationException::withMessages(['unit_id' => __('The selected unit is not available.')]);
        }

        $resident = null;
        if (! empty($validated['resident_id'])) {
            // The person must currently live in that unit.
            $resident = Resident::query()
                ->whereKey($validated['resident_id'])
                ->whereHas('unitMemberships', fn (Builder $query) => $query->where('unit_id', $unit->id)->active())
                ->first();
            if ($resident === null) {
                throw ValidationException::withMessages(['resident_id' => __('The selected person does not live in this unit.')]);
            }
        }

        /** @var User $actor */
        $actor = $request->user();

        $package = $register->handle($unit, $resident, $actor, $validated['notes'] ?? null);

        return (new PackageResource($package->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function deliver(Request $request, Package $package, DeliverPackage $deliver): JsonResource
    {
        Gate::authorize('deliver', $package);

        $validated = $request->validate(['delivered_to' => ['sometimes', 'nullable', 'string', 'max:255']]);

        /** @var User $actor */
        $actor = $request->user();

        return new PackageResource($deliver->handle($package, $actor, $validated['delivered_to'] ?? null)->load(self::RELATIONS));
    }
}
