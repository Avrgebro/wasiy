<?php

namespace App\Http\Controllers\Api;

use App\Actions\Locations\CreateLocation;
use App\Actions\Locations\DeactivateLocation;
use App\Actions\Locations\ReactivateLocation;
use App\Actions\Locations\UpdateLocation;
use App\Enums\LocationType;
use App\Enums\RegistryStatus;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLocationRequest;
use App\Http\Requests\UpdateLocationRequest;
use App\Http\Resources\LocationResource;
use App\Models\Account;
use App\Models\Location;
use App\Models\StaffLocationRole;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\AccessAuthorizationService;
use App\Services\AccessContextService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class LocationController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly AccessContextService $context,
    ) {}

    public function index(Request $request, Account $account): AnonymousResourceCollection
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('viewAny', [Location::class, $account]);

        $validated = $request->validate([
            ...$this->paginationRules(),
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'deactivated'])],
            'type' => ['sometimes', 'nullable', Rule::enum(LocationType::class)],
        ]);

        $locations = $this->withTileCounts($account->locations()->getQuery())
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->searchLike(
                ['name', 'address_line1', 'district', 'city'],
                $search,
            ))
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $status === 'active'
                ? $query->active()
                : $query->deactivated())
            ->when($validated['type'] ?? null, fn (Builder $query, string $type) => $query->where('type', $type))
            ->orderBy('name')
            ->paginate($this->perPage($validated))
            ->withQueryString();

        return LocationResource::collection($locations);
    }

    public function store(StoreLocationRequest $request, Account $account, CreateLocation $createLocation): JsonResponse
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('create', [Location::class, $account]);

        /** @var User $actor */
        $actor = $request->user();

        $location = $createLocation->handle($account, $actor, $request->validated());

        return (new LocationResource($this->freshWithTileCounts($location)))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Account $account, Location $location): JsonResource
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('view', $location);

        return new LocationResource($this->freshWithTileCounts($location));
    }

    public function update(
        UpdateLocationRequest $request,
        Account $account,
        Location $location,
        UpdateLocation $updateLocation,
    ): JsonResource {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $location);

        /** @var User $actor */
        $actor = $request->user();

        $updateLocation->handle($location, $actor, $request->validated());

        return new LocationResource($this->freshWithTileCounts($location));
    }

    public function deactivate(
        Request $request,
        Account $account,
        Location $location,
        DeactivateLocation $deactivateLocation,
    ): JsonResource {
        $this->authorizeAccount($request, $account);
        Gate::authorize('deactivate', $location);

        /** @var User $actor */
        $actor = $request->user();

        $deactivateLocation->handle($location, $actor);
        // The actor must not be left operating a Location that no longer
        // grants access; other sessions self-heal through sync().
        $this->context->forgetLocationIfActive($request, $location);

        return new LocationResource($this->freshWithTileCounts($location)->load('deactivatedBy'));
    }

    public function reactivate(
        Request $request,
        Account $account,
        Location $location,
        ReactivateLocation $reactivateLocation,
    ): JsonResource {
        $this->authorizeAccount($request, $account);
        Gate::authorize('reactivate', $location);

        /** @var User $actor */
        $actor = $request->user();

        $reactivateLocation->handle($location, $actor);

        return new LocationResource($this->freshWithTileCounts($location));
    }

    /**
     * Cross-account probing gets a 404, not a 403: someone outside the
     * Account should not learn that it exists.
     */
    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }

    /**
     * The counts the location tiles render. Registry counts follow the
     * lifecycle rule: only active records count as operational.
     *
     * @param  Builder<Location>  $query
     * @return Builder<Location>
     */
    private function withTileCounts(Builder $query): Builder
    {
        return $query
            ->with('photos')
            ->withCount([
                'units as units_count' => fn (Builder $units) => $units->where('status', RegistryStatus::Active),
                'vehicles as vehicles_count' => fn (Builder $vehicles) => $vehicles->where('status', RegistryStatus::Active),
                'amenities as active_amenities_count' => fn (Builder $amenities) => $amenities->whereNull('deactivated_at'),
            ])
            ->addSelect([
                'residents_count' => UnitMembership::query()
                    ->selectRaw('count(distinct resident_id)')
                    ->whereColumn('location_id', 'locations.id')
                    ->where('status', RegistryStatus::Active),
                'staff_count' => StaffLocationRole::query()
                    ->selectRaw('count(distinct staff_membership_id)')
                    ->whereColumn('location_id', 'locations.id')
                    ->whereHas('membership', fn (Builder $membership) => $membership->whereNull('deactivated_at')),
                'unclaimed_invitations_count' => UserInvitation::query()
                    ->selectRaw('count(*)')
                    ->whereColumn('location_id', 'locations.id')
                    ->where('purpose', UserInvitationPurpose::Resident)
                    ->where('status', UserInvitationStatus::Pending),
            ]);
    }

    private function freshWithTileCounts(Location $location): Location
    {
        return $this->withTileCounts(Location::query())->findOrFail($location->id);
    }
}
