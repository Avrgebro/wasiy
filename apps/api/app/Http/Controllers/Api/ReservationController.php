<?php

namespace App\Http\Controllers\Api;

use App\Actions\Reservations\CreateReservation;
use App\Actions\Reservations\DecideReservation;
use App\Enums\AccountRole;
use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReservationRequest;
use App\Http\Resources\ReservationResource;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class ReservationController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * One list serves the agenda, the day viewer, and the approval queue:
     * `from`/`to` are local dates in the Location's timezone, `status`
     * accepts a comma-separated set.
     */
    public function index(Request $request, Account $account, Location $location): AnonymousResourceCollection
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('viewAny', [Reservation::class, $location]);

        $validated = $request->validate([
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d'],
            'status' => ['sometimes', 'string'],
            'amenity_id' => ['sometimes', 'string', 'ulid'],
        ]);

        $statuses = collect(explode(',', $validated['status'] ?? ''))
            ->filter(fn (string $status): bool => ReservationStatus::tryFrom($status) !== null);

        $timezone = $location->timezone;

        $reservations = Reservation::query()
            ->where('location_id', $location->id)
            ->with(['amenity', 'unit', 'resident', 'createdBy', 'decidedBy', 'movements'])
            ->when($validated['from'] ?? null, fn ($query, string $from) => $query->where(
                'ends_at', '>', CarbonImmutable::parse($from, $timezone)->startOfDay()->utc(),
            ))
            ->when($validated['to'] ?? null, fn ($query, string $to) => $query->where(
                'starts_at', '<', CarbonImmutable::parse($to, $timezone)->addDay()->startOfDay()->utc(),
            ))
            ->when($statuses->isNotEmpty(), fn ($query) => $query->whereIn('status', $statuses))
            ->when($validated['amenity_id'] ?? null, fn ($query, string $amenityId) => $query
                ->where('amenity_id', $amenityId))
            ->orderBy('starts_at')
            ->get();

        return ReservationResource::collection($reservations);
    }

    public function store(
        StoreReservationRequest $request,
        Account $account,
        Location $location,
        CreateReservation $createReservation,
    ): JsonResponse {
        $this->authorizeAccount($request, $account);
        Gate::authorize('create', [Reservation::class, $location]);

        $validated = $request->validated();

        $amenity = Amenity::query()
            ->where('location_id', $location->id)
            ->findOrFail($validated['amenity_id']);
        $unit = Unit::query()
            ->where('location_id', $location->id)
            ->findOrFail($validated['unit_id']);
        $resident = isset($validated['resident_id'])
            ? Resident::query()->where('account_id', $account->id)->findOrFail($validated['resident_id'])
            : null;

        /** @var User $actor */
        $actor = $request->user();

        $timezone = $location->timezone;
        $startsAt = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['start']}", $timezone)->utc();
        $endsAt = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['end']}", $timezone)->utc();

        $reservation = $createReservation->handle($amenity, $unit, $resident, $actor, $startsAt, $endsAt);

        return (new ReservationResource($reservation->load(['amenity', 'unit', 'resident', 'createdBy', 'decidedBy', 'movements'])))
            ->response()->setStatusCode(201);
    }

    /**
     * One booking with its ledger rows and a merged history: the
     * reservation's own events plus the events of the movements it opened,
     * newest first, so the drawer's timeline tells the whole story.
     */
    public function show(Request $request, Account $account, Reservation $reservation): JsonResource
    {
        $this->authorizeAccount($request, $account);
        abort_unless($reservation->account_id === $account->id, 404);
        Gate::authorize('view', $reservation);

        $reservation->load(['amenity', 'unit', 'resident', 'createdBy', 'decidedBy', 'movements']);
        $movementIds = $reservation->movements->pluck('id')->all();

        $history = ActivityLog::query()
            ->where(fn ($query) => $query
                ->where(fn ($own) => $own->where('subject_type', 'reservation')->where('subject_id', $reservation->id))
                ->orWhere(fn ($money) => $money->where('subject_type', 'financial_movement')->whereIn('subject_id', $movementIds)))
            ->with('actor')
            // ULIDs are time-ordered: they break same-second ties.
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'subject' => $entry->subject_type === 'reservation' ? 'reservation' : 'movement',
                'event_type' => $entry->event_type->value,
                'status' => $entry->metadata['status'] ?? null,
                'previous_status' => $entry->metadata['previous_status'] ?? null,
                'note' => $entry->metadata['status_note'] ?? null,
                'category' => $entry->metadata['category'] ?? null,
                'amount' => $entry->metadata['amount'] ?? null,
                'actor_name' => $entry->actor?->name,
                'created_at' => $entry->created_at?->toJSON(),
            ])
            ->all();

        return (new ReservationResource($reservation))->additional(['history' => $history]);
    }

    public function approve(Request $request, Account $account, Reservation $reservation, DecideReservation $decide): JsonResource
    {
        $actor = $this->authorizeDecision($request, $account, $reservation);

        return new ReservationResource($decide->approve($reservation, $actor)->load(['amenity', 'unit', 'resident', 'createdBy', 'decidedBy', 'movements']));
    }

    public function reject(Request $request, Account $account, Reservation $reservation, DecideReservation $decide): JsonResource
    {
        $actor = $this->authorizeDecision($request, $account, $reservation);
        $validated = $request->validate(['note' => ['required', 'string', 'max:1000']]);

        return new ReservationResource($decide->reject($reservation, $actor, $validated['note'])->load(['amenity', 'unit', 'resident', 'createdBy', 'decidedBy', 'movements']));
    }

    public function observe(Request $request, Account $account, Reservation $reservation, DecideReservation $decide): JsonResource
    {
        $actor = $this->authorizeDecision($request, $account, $reservation);
        $validated = $request->validate(['note' => ['required', 'string', 'max:1000']]);

        return new ReservationResource($decide->observe($reservation, $actor, $validated['note'])->load(['amenity', 'unit', 'resident', 'createdBy', 'decidedBy', 'movements']));
    }

    public function cancel(Request $request, Account $account, Reservation $reservation, DecideReservation $decide): JsonResource
    {
        $this->authorizeAccount($request, $account);
        abort_unless($reservation->account_id === $account->id, 404);
        Gate::authorize('cancel', $reservation);

        $validated = $request->validate(['note' => ['sometimes', 'nullable', 'string', 'max:1000']]);

        /** @var User $actor */
        $actor = $request->user();
        // Admins may cancel inside the amenity's cancellation window.
        $bypassWindow = $this->access->hasAccountRole($actor, $account, AccountRole::AccountAdmin);

        return new ReservationResource(
            $decide->cancel($reservation, $actor, $validated['note'] ?? null, $bypassWindow)
                ->load(['amenity', 'unit', 'resident', 'createdBy', 'decidedBy', 'movements']),
        );
    }

    private function authorizeDecision(Request $request, Account $account, Reservation $reservation): User
    {
        $this->authorizeAccount($request, $account);
        abort_unless($reservation->account_id === $account->id, 404);
        Gate::authorize('decide', $reservation);

        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }
}
