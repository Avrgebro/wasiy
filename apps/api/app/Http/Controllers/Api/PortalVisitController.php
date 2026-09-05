<?php

namespace App\Http\Controllers\Api;

use App\Actions\Visits\CancelExpectedVisit;
use App\Actions\Visits\PreRegisterVisit;
use App\Enums\VisitStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\VisitResource;
use App\Models\Unit;
use App\Models\User;
use App\Models\Visit;
use App\Services\AccessAuthorizationService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Resident-facing visits (portal P1): announce a visitor for a unit the
 * resident lives in, see what is expected and what happened, withdraw a
 * pre-registration while nobody has arrived. Everything is scoped to one
 * unit — the portal's unit switcher.
 */
class PortalVisitController extends Controller
{
    private const RELATIONS = ['unit', 'resident', 'checkedInBy', 'checkedOutBy', 'preRegisteredBy'];

    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            ...$this->paginationRules(),
            'unit_id' => ['required', 'string', 'ulid'],
            // expected = upcoming pre-registrations; history = everything else, newest first.
            'scope' => ['sometimes', 'nullable', 'in:expected,today,history'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAsResident', [Visit::class, $unit]);

        $scope = $validated['scope'] ?? 'expected';
        $today = CarbonImmutable::now($unit->location->timezone);
        $visits = Visit::query()
            ->where('unit_id', $unit->id)
            ->with(self::RELATIONS)
            // The home board: still expected for today, plus whoever arrived today.
            ->when($scope === 'today', fn (Builder $query) => $query
                ->where(fn (Builder $day) => $day
                    ->where(fn (Builder $expected) => $expected->where('status', VisitStatus::Expected->value)->where('expected_on', $today->toDateString()))
                    ->orWhere(fn (Builder $arrived) => $arrived->whereIn('status', [VisitStatus::Inside->value, VisitStatus::Left->value])->where('checked_in_at', '>=', $today->startOfDay()->utc())))
                ->orderByRaw("CASE WHEN status = 'expected' THEN 0 ELSE 1 END")->orderByRaw('expected_time NULLS LAST')->orderByDesc('checked_in_at'))
            ->when($scope === 'expected', fn (Builder $query) => $query
                ->where('status', VisitStatus::Expected->value)
                ->where('expected_on', '>=', CarbonImmutable::now($unit->location->timezone)->toDateString())
                ->orderBy('expected_on')->orderByRaw('expected_time NULLS LAST'))
            ->when($scope === 'history', fn (Builder $query) => $query
                ->where(fn (Builder $done) => $done
                    ->whereIn('status', [VisitStatus::Inside->value, VisitStatus::Left->value, VisitStatus::Cancelled->value])
                    ->orWhere(fn (Builder $past) => $past->where('status', VisitStatus::Expected->value)
                        ->where('expected_on', '<', CarbonImmutable::now($unit->location->timezone)->toDateString())))
                ->orderByRaw('COALESCE(checked_in_at, cancelled_at, expected_on) DESC'))
            ->orderByDesc('id');

        return VisitResource::collection($visits->paginate($this->perPage($validated))->withQueryString());
    }

    public function store(Request $request, PreRegisterVisit $preRegister): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resident = $this->access->residentForUser($user);
        abort_unless($resident !== null, 403);

        $validated = $request->validate([
            'unit_id' => ['required', 'string', 'ulid'],
            'visitor_name' => ['required', 'string', 'max:255'],
            'document' => ['sometimes', 'nullable', 'string', 'max:64'],
            'expected_on' => ['required', 'date_format:Y-m-d'],
            'expected_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('preRegister', [Visit::class, $unit]);

        if ($validated['expected_on'] < CarbonImmutable::now($unit->location->timezone)->toDateString()) {
            throw ValidationException::withMessages(['expected_on' => __('The expected date cannot be in the past.')]);
        }

        $visit = $preRegister->handle($unit, $resident, $validated);

        return (new VisitResource($visit->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function cancel(Request $request, Visit $visit, CancelExpectedVisit $cancel): JsonResource
    {
        Gate::authorize('cancelAsResident', $visit);
        $resident = $this->access->residentForUser($request->user());
        abort_unless($resident !== null, 403);

        return new VisitResource($cancel->handle($visit, $resident)->load(self::RELATIONS));
    }
}
