<?php

namespace App\Http\Controllers\Api;

use App\Actions\Visits\CheckOutVisit;
use App\Actions\Visits\ConfirmExpectedVisit;
use App\Actions\Visits\RegisterVisit;
use App\Enums\RegistryStatus;
use App\Enums\VisitConfirmation;
use App\Enums\VisitStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\VisitResource;
use App\Models\Location;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\User;
use App\Models\Visit;
use App\Support\PhoneNumber;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VisitController extends Controller
{
    private const RELATIONS = ['unit', 'resident', 'checkedInBy', 'checkedOutBy', 'preRegisteredBy'];

    public function index(Request $request, Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Visit::class, $location]);

        $validated = $request->validate([
            ...$this->paginationRules(),
            'status' => ['sometimes', 'nullable', Rule::enum(VisitStatus::class)],
            'today' => ['sometimes', 'nullable', 'boolean'],
            // Pre-registrations for today (portal P1); combine with unit_id for the drawer band.
            'expected' => ['sometimes', 'nullable', 'boolean'],
            'unit_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'confirmation' => ['sometimes', 'nullable', Rule::enum(VisitConfirmation::class)],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $now = CarbonImmutable::now($location->timezone);
        $startOfToday = $now->startOfDay()->utc();
        $expected = (bool) ($validated['expected'] ?? false);

        $visits = Visit::query()
            ->where('location_id', $location->id)
            ->when($validated['unit_id'] ?? null, fn (Builder $query, string $unitId) => $query->where('unit_id', $unitId))
            ->when($expected, fn (Builder $query) => $query
                ->where('status', VisitStatus::Expected->value)
                ->where('expected_on', $now->toDateString()))
            // The desk's log is what happened at the door; pre-registrations show only when asked for.
            ->when(! $expected && ! isset($validated['status']), fn (Builder $query) => $query->whereIn('status', [VisitStatus::Inside->value, VisitStatus::Left->value]))
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when((bool) ($validated['today'] ?? false), fn (Builder $query) => $query->where('checked_in_at', '>=', $startOfToday))
            ->when($validated['confirmation'] ?? null, fn (Builder $query, string $confirmation) => $query->where('confirmation', $confirmation))
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->where(fn (Builder $group) => $group
                ->searchLike(['visitor_name', 'document'], $search)
                ->orWhereHas('unit', fn (Builder $unit) => $unit->searchIdentity($search))
                ->orWhereHas('resident', fn (Builder $resident) => $resident->searchLike(["CONCAT(first_name, ' ', last_name)"], $search))))
            ->with(self::RELATIONS)
            ->when($expected, fn (Builder $query) => $query->orderByRaw('expected_time NULLS LAST')->orderBy('pre_registered_at'), fn (Builder $query) => $query->orderByDesc('checked_in_at'))
            ->orderByDesc('id');

        return VisitResource::collection($visits->paginate($this->perPage($validated))->withQueryString());
    }

    /** The desk confirms a pre-registered visitor is at the door (16c). */
    public function confirmArrival(Request $request, Visit $visit, ConfirmExpectedVisit $confirm): JsonResource
    {
        Gate::authorize('confirmArrival', $visit);

        $validated = $request->validate([
            'visitor_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'document' => ['sometimes', 'nullable', 'string', 'max:64'],
            'phone' => ['sometimes', ...PhoneNumber::rules($visit->location->country ?? PhoneNumber::FALLBACK_COUNTRY)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);
        if (array_key_exists('phone', $validated)) {
            $validated['phone'] = PhoneNumber::normalize($validated['phone'], $visit->location->country ?? PhoneNumber::FALLBACK_COUNTRY);
        }

        /** @var User $actor */
        $actor = $request->user();

        return new VisitResource($confirm->handle($visit, $actor, $validated)->load(self::RELATIONS));
    }

    public function store(Request $request, Location $location, RegisterVisit $register): JsonResponse
    {
        Gate::authorize('create', [Visit::class, $location]);

        $validated = $request->validate([
            'visitor_name' => ['required', 'string', 'max:255'],
            'unit_id' => ['required', 'string', 'ulid'],
            'resident_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'document' => ['sometimes', 'nullable', 'string', 'max:64'],
            'phone' => ['sometimes', ...PhoneNumber::rules($location->country ?? PhoneNumber::FALLBACK_COUNTRY)],
            'confirmation' => ['sometimes', 'nullable', Rule::enum(VisitConfirmation::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $unit = Unit::query()
            ->where('location_id', $location->id)
            ->where('status', RegistryStatus::Active->value)
            ->find($validated['unit_id']);
        if ($unit === null) {
            throw ValidationException::withMessages(['unit_id' => __('The selected unit is not available.')]);
        }

        $host = null;
        if (! empty($validated['resident_id'])) {
            $host = Resident::query()
                ->whereKey($validated['resident_id'])
                ->whereHas('unitMemberships', fn (Builder $query) => $query->where('unit_id', $unit->id)->active())
                ->first();
            if ($host === null) {
                throw ValidationException::withMessages(['resident_id' => __('The selected person does not live in this unit.')]);
            }
        }

        /** @var User $actor */
        $actor = $request->user();
        $validated['phone'] = PhoneNumber::normalize($validated['phone'] ?? null, $location->country ?? PhoneNumber::FALLBACK_COUNTRY);

        $visit = $register->handle($unit, $host, $actor, $validated);

        return (new VisitResource($visit->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function checkOut(Request $request, Visit $visit, CheckOutVisit $checkOut): JsonResource
    {
        Gate::authorize('checkOut', $visit);

        $validated = $request->validate(['notes' => ['sometimes', 'nullable', 'string', 'max:1000']]);

        /** @var User $actor */
        $actor = $request->user();

        return new VisitResource($checkOut->handle($visit, $actor, $validated['notes'] ?? null)->load(self::RELATIONS));
    }
}
