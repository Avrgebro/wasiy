<?php

namespace App\Http\Controllers\Api;

use App\Actions\Reservations\CreateReservation;
use App\Actions\Reservations\DecideReservation;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReservationResource;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\Reservation;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * Resident-facing bookings (portal P2), scoped to one unit. Requests reuse the
 * staff action, so instant amenities confirm on the spot and approval ones
 * enter the same queue. Residents may cancel until the booking starts.
 */
class PortalReservationController extends Controller
{
    private const RELATIONS = ['amenity', 'unit', 'resident', 'createdBy', 'decidedBy'];

    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            ...$this->paginationRules(),
            'unit_id' => ['required', 'string', 'ulid'],
            'scope' => ['sometimes', 'nullable', 'in:upcoming,past'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAsResident', [Reservation::class, $unit]);

        $scope = $validated['scope'] ?? 'upcoming';
        $reservations = Reservation::query()
            ->where('unit_id', $unit->id)
            ->with(self::RELATIONS)
            ->when($scope === 'upcoming', fn (Builder $query) => $query
                ->whereIn('status', ['pending', 'observed', 'approved'])
                ->where('ends_at', '>', now())
                ->orderBy('starts_at'))
            ->when($scope === 'past', fn (Builder $query) => $query
                ->where(fn (Builder $done) => $done->whereIn('status', ['rejected', 'cancelled'])->orWhere('ends_at', '<=', now()))
                ->orderByDesc('starts_at'));

        return ReservationResource::collection($reservations->paginate($this->perPage($validated))->withQueryString());
    }

    public function show(Request $request, Reservation $reservation): JsonResource
    {
        Gate::authorize('cancelAsResident', $reservation);
        $reservation->load(self::RELATIONS);

        $history = ActivityLog::query()
            ->where('subject_type', 'reservation')->where('subject_id', $reservation->id)
            ->with('actor')
            ->orderBy('created_at')->orderBy('id')
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'event_type' => $entry->event_type->value,
                'status' => $entry->metadata['status'] ?? null,
                'note' => $entry->metadata['status_note'] ?? null,
                'actor_name' => $entry->actor?->name,
                'created_at' => $entry->created_at?->toJSON(),
            ])
            ->all();

        return (new ReservationResource($reservation))->additional([
            'history' => $history,
            // Whether the resident can still cancel: undecided or approved, and not started (ADR 0041).
            'can_cancel' => in_array($reservation->status->value, ['pending', 'observed', 'approved'], true)
                && $reservation->starts_at->gt(now()),
        ]);
    }

    public function store(Request $request, CreateReservation $create): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resident = $this->access->residentForUser($user);
        abort_unless($resident !== null, 403);

        $validated = $request->validate([
            'unit_id' => ['required', 'string', 'ulid'],
            'amenity_id' => ['required', 'string', 'ulid'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('createAsResident', [Reservation::class, $unit]);
        $amenity = Amenity::query()->where('location_id', $unit->location_id)->findOrFail($validated['amenity_id']);

        $timezone = $unit->location->timezone;
        $startsAt = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['start']}", $timezone);
        $endsAt = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['end']}", $timezone);

        $reservation = $create->handle($amenity, $unit, $resident, $user, $startsAt->utc(), $endsAt->utc());

        return (new ReservationResource($reservation->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function cancel(Request $request, Reservation $reservation, DecideReservation $decide): JsonResource
    {
        Gate::authorize('cancelAsResident', $reservation);

        /** @var User $user */
        $user = $request->user();

        return new ReservationResource($decide->cancel($reservation, $user, null, asResident: true)->load(self::RELATIONS));
    }
}
