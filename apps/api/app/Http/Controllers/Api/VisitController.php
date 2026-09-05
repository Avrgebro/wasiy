<?php

namespace App\Http\Controllers\Api;

use App\Actions\Visits\CheckOutVisit;
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
    private const RELATIONS = ['unit', 'resident', 'checkedInBy', 'checkedOutBy'];

    public function index(Request $request, Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Visit::class, $location]);

        $validated = $request->validate([
            ...$this->paginationRules(),
            'status' => ['sometimes', 'nullable', Rule::enum(VisitStatus::class)],
            'today' => ['sometimes', 'nullable', 'boolean'],
            'confirmation' => ['sometimes', 'nullable', Rule::enum(VisitConfirmation::class)],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $startOfToday = CarbonImmutable::now($location->timezone)->startOfDay()->utc();

        $visits = Visit::query()
            ->where('location_id', $location->id)
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when((bool) ($validated['today'] ?? false), fn (Builder $query) => $query->where('checked_in_at', '>=', $startOfToday))
            ->when($validated['confirmation'] ?? null, fn (Builder $query, string $confirmation) => $query->where('confirmation', $confirmation))
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->where(fn (Builder $group) => $group
                ->searchLike(['visitor_name', 'document'], $search)
                ->orWhereHas('unit', fn (Builder $unit) => $unit->searchIdentity($search))
                ->orWhereHas('resident', fn (Builder $resident) => $resident->searchLike(["CONCAT(first_name, ' ', last_name)"], $search))))
            ->with(self::RELATIONS)
            ->orderByDesc('checked_in_at')
            ->orderByDesc('id');

        return VisitResource::collection($visits->paginate($this->perPage($validated))->withQueryString());
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
