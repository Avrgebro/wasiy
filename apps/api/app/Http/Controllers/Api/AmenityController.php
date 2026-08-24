<?php

namespace App\Http\Controllers\Api;

use App\Actions\Amenities\SaveAmenity;
use App\Enums\ActivityEventType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAmenityRequest;
use App\Http\Requests\UpdateAmenityRequest;
use App\Http\Resources\AmenityResource;
use App\Models\Account;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class AmenityController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function index(Request $request, Account $account, Location $location): AnonymousResourceCollection
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('viewAny', [Amenity::class, $location]);

        $validated = $request->validate([
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'deactivated'])],
        ]);

        $amenities = $location->amenities()
            ->with('photos')
            ->when($validated['status'] ?? null, fn ($query, string $status) => $status === 'active'
                ? $query->whereNull('deactivated_at')
                : $query->whereNotNull('deactivated_at'))
            ->orderBy('name')
            ->get();

        return AmenityResource::collection($amenities);
    }

    public function store(
        StoreAmenityRequest $request,
        Account $account,
        Location $location,
        SaveAmenity $saveAmenity,
    ): JsonResponse {
        $this->authorizeAccount($request, $account);
        Gate::authorize('create', [Amenity::class, $location]);

        /** @var User $actor */
        $actor = $request->user();

        $amenity = $saveAmenity->create($location, $actor, $request->validated());

        return (new AmenityResource($amenity->load('photos')))->response()->setStatusCode(201);
    }

    public function show(Request $request, Account $account, Location $location, Amenity $amenity): JsonResource
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('view', $amenity);

        return new AmenityResource($amenity->load('photos'));
    }

    public function update(
        UpdateAmenityRequest $request,
        Account $account,
        Location $location,
        Amenity $amenity,
        SaveAmenity $saveAmenity,
    ): JsonResource {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $amenity);

        /** @var User $actor */
        $actor = $request->user();

        return new AmenityResource($saveAmenity->update($amenity, $actor, $request->validated())->load('photos'));
    }

    public function deactivate(Request $request, Account $account, Location $location, Amenity $amenity): JsonResponse
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('deactivate', $amenity);

        /** @var User $actor */
        $actor = $request->user();

        $amenity->deactivate();
        $this->logLifecycle($amenity, $actor, ActivityEventType::AmenityDeactivated, "Se desactivó la amenidad {$amenity->name}.");

        return (new AmenityResource($amenity->load('photos')))
            ->additional([
                'meta' => [
                    // Real once the reservations milestone lands; the modal
                    // contract (06d) ships now.
                    'future_reservations' => 0,
                ],
            ])
            ->response();
    }

    public function reactivate(Request $request, Account $account, Location $location, Amenity $amenity): JsonResource
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('reactivate', $amenity);

        /** @var User $actor */
        $actor = $request->user();

        $amenity->reactivate();
        $this->logLifecycle($amenity, $actor, ActivityEventType::AmenityReactivated, "Se reactivó la amenidad {$amenity->name}.");

        return new AmenityResource($amenity->load('photos'));
    }

    private function logLifecycle(Amenity $amenity, User $actor, ActivityEventType $eventType, string $summary): void
    {
        $this->activityLogger->log(
            account: $amenity->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'amenity_id' => $amenity->id,
                'amenity_name' => $amenity->name,
            ],
            location: $amenity->location,
            actor: $actor,
            subjectType: 'amenity',
            subjectId: $amenity->id,
        );
    }

    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }
}
