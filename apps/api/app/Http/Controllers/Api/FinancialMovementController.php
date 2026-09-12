<?php

namespace App\Http\Controllers\Api;

use App\Actions\Finances\GenerateMonthlyDues;
use App\Actions\Finances\RecordMovement;
use App\Actions\Finances\TransitionMovement;
use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFinancialMovementRequest;
use App\Http\Resources\FinancialMovementResource;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Support\SortParser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class FinancialMovementController extends Controller
{
    private const RELATIONS = ['unit', 'createdBy', 'settledBy'];

    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * The month list. `month` is a local YYYY-MM in the Location's timezone
     * and defaults to the current one; `status` and `category` accept
     * comma-separated sets.
     */
    public function index(Request $request, Account $account, Location $location): AnonymousResourceCollection
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('viewAny', [FinancialMovement::class, $location]);

        $validated = $request->validate([
            ...$this->paginationRules(),
            'month' => ['sometimes', 'nullable', 'date_format:Y-m'],
            'direction' => ['sometimes', 'nullable', Rule::enum(MovementDirection::class)],
            'status' => ['sometimes', 'nullable', 'string', 'max:255'],
            'category' => ['sometimes', 'nullable', 'string', 'max:255'],
            'unit_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'sort' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $statuses = $this->enumSet($validated['status'] ?? null, MovementStatus::class);
        $categories = $this->enumSet($validated['category'] ?? null, MovementCategory::class);

        $movements = FinancialMovement::query()
            ->where('location_id', $location->id)
            ->inMonth($this->month($validated, $location))
            ->when($validated['direction'] ?? null, fn (Builder $query, string $direction) => $query
                ->where('direction', $direction))
            ->when($statuses !== [], fn (Builder $query) => $query->whereIn('status', $statuses))
            ->when($categories !== [], fn (Builder $query) => $query->whereIn('category', $categories))
            ->when($validated['unit_id'] ?? null, fn (Builder $query, string $unitId) => $query->where('unit_id', $unitId))
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query
                ->searchLike(['concept', 'detail', 'counterparty'], $search))
            ->with(self::RELATIONS);

        SortParser::apply($movements, $validated['sort'] ?? null, [
            'occurred_on' => 'occurred_on',
            'amount_minor' => 'amount_minor',
            'status' => 'status',
            'created_at' => 'created_at',
        ], default: '-occurred_on,-created_at');

        return FinancialMovementResource::collection(
            $movements->paginate($this->perPage($validated))->withQueryString(),
        );
    }

    /**
     * The four tiles. Income and expenses are month-bound by occurred_on;
     * receivables, payables and deposits are outstanding balances and
     * ignore the month.
     */
    public function summary(Request $request, Account $account, Location $location): JsonResponse
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('viewAny', [FinancialMovement::class, $location]);

        $validated = $request->validate([
            'month' => ['sometimes', 'nullable', 'date_format:Y-m'],
        ]);
        $month = $this->month($validated, $location);

        $base = fn (): Builder => FinancialMovement::query()->where('location_id', $location->id);

        $income = $base()->inMonth($month)
            ->where('direction', MovementDirection::Income->value)
            ->where('category', '!=', MovementCategory::ReservationDeposit->value)
            ->where('status', MovementStatus::Paid->value);
        $expense = $base()->inMonth($month)
            ->where('direction', MovementDirection::Expense->value)
            ->where('status', MovementStatus::Paid->value);
        $receivable = $base()
            ->where('direction', MovementDirection::Income->value)
            ->where('status', MovementStatus::Pending->value);
        $payable = $base()
            ->where('direction', MovementDirection::Expense->value)
            ->where('status', MovementStatus::Pending->value);
        $held = $base()->where('status', MovementStatus::Held->value);

        $incomeTotal = (int) $income->clone()->sum('amount_minor');
        $expenseTotal = (int) $expense->clone()->sum('amount_minor');

        // Tiles are statistics only: breakdowns by category and a
        // month-over-month comparison, never interpretive copy.
        $byCategory = fn (Builder $query): array => $query->clone()
            ->selectRaw('category, SUM(amount_minor) AS total_minor, COUNT(*) AS count')
            ->groupBy('category')
            ->orderByDesc('total_minor')
            ->get()
            ->map(fn ($row): array => [
                'category' => $row->category->value,
                'total_minor' => (int) $row->total_minor,
                'count' => (int) $row->count,
            ])
            ->all();

        $previousMonth = CarbonImmutable::createFromFormat('Y-m-d', "{$month}-01")->subMonth()->format('Y-m');
        $previousIncome = (int) $base()->inMonth($previousMonth)
            ->where('direction', MovementDirection::Income->value)
            ->where('category', '!=', MovementCategory::ReservationDeposit->value)
            ->where('status', MovementStatus::Paid->value)->sum('amount_minor');
        $previousExpense = (int) $base()->inMonth($previousMonth)
            ->where('direction', MovementDirection::Expense->value)
            ->where('status', MovementStatus::Paid->value)->sum('amount_minor');

        return response()->json(['data' => [
            'month' => $month,
            'income_total_minor' => $incomeTotal,
            'income_count' => $income->count(),
            'income_by_category' => $byCategory($income),
            'expense_total_minor' => $expenseTotal,
            'expense_count' => $expense->count(),
            'expense_by_category' => $byCategory($expense),
            'balance_minor' => $incomeTotal - $expenseTotal,
            'previous_month' => $previousMonth,
            'previous_balance_minor' => $previousIncome - $previousExpense,
            'receivable_total_minor' => (int) $receivable->clone()->sum('amount_minor'),
            'receivable_count' => $receivable->count(),
            'payable_total_minor' => (int) $payable->clone()->sum('amount_minor'),
            'payable_count' => $payable->count(),
            'deposits_held_total_minor' => (int) $held->sum('amount_minor'),
        ]]);
    }

    /**
     * One movement with its history: the activity entries recorded against
     * it, newest first, so the drawer's timeline needs no second endpoint.
     */
    public function show(Request $request, Account $account, FinancialMovement $financialMovement): JsonResource
    {
        $this->authorizeAccount($request, $account);
        abort_unless($financialMovement->account_id === $account->id, 404);
        Gate::authorize('view', $financialMovement);

        $history = ActivityLog::query()
            ->where('subject_type', 'financial_movement')
            ->where('subject_id', $financialMovement->id)
            ->with('actor')
            // ULIDs are time-ordered: they break same-second ties.
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'event_type' => $entry->event_type->value,
                'status' => $entry->metadata['status'] ?? null,
                'previous_status' => $entry->metadata['previous_status'] ?? null,
                'actor_name' => $entry->actor?->name,
                'created_at' => $entry->created_at?->toJSON(),
            ])
            ->all();

        return (new FinancialMovementResource($financialMovement->load([...self::RELATIONS, 'reservation.amenity'])))
            ->additional(['history' => $history]);
    }

    public function store(
        StoreFinancialMovementRequest $request,
        Account $account,
        Location $location,
        RecordMovement $record,
    ): JsonResponse {
        $this->authorizeAccount($request, $account);
        Gate::authorize('create', [FinancialMovement::class, $location]);

        $validated = $request->validated();

        if (isset($validated['unit_id'])) {
            Unit::query()->where('location_id', $location->id)->findOrFail($validated['unit_id']);
        }

        /** @var User $actor */
        $actor = $request->user();

        $status = MovementStatus::tryFrom($validated['status'] ?? '') ?? MovementStatus::Pending;
        unset($validated['status']);

        $movement = $record->handle($location, $actor, $validated, $status);

        return (new FinancialMovementResource($movement->load(self::RELATIONS)))
            ->response()->setStatusCode(201);
    }

    /**
     * "Generar cuotas del mes": one pending dues row per active unit with a
     * fee; rerunning only fills the gaps.
     */
    public function generateDues(Request $request, Account $account, Location $location, GenerateMonthlyDues $generate): JsonResponse
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('create', [FinancialMovement::class, $location]);

        $validated = $request->validate(['month' => ['sometimes', 'nullable', 'date_format:Y-m']]);

        /** @var User $actor */
        $actor = $request->user();

        return response()->json(['data' => $generate->handle($location, $actor, $this->month($validated, $location))]);
    }

    public function transition(
        Request $request,
        Account $account,
        FinancialMovement $financialMovement,
        TransitionMovement $transition,
    ): JsonResource {
        $this->authorizeAccount($request, $account);
        $movement = $financialMovement;
        abort_unless($movement->account_id === $account->id, 404);
        Gate::authorize('manage', $movement);

        $validated = $request->validate([
            'status' => ['required', Rule::enum(MovementStatus::class)],
            'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        /** @var User $actor */
        $actor = $request->user();

        return new FinancialMovementResource(
            $transition->handle($movement, $actor, MovementStatus::from($validated['status']), $validated['note'] ?? null)
                ->load(self::RELATIONS),
        );
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function month(array $validated, Location $location): string
    {
        return $validated['month'] ?? CarbonImmutable::now($location->timezone)->format('Y-m');
    }

    /**
     * @template T of \BackedEnum
     *
     * @param  class-string<T>  $enum
     * @return list<string>
     */
    private function enumSet(?string $raw, string $enum): array
    {
        return collect(explode(',', (string) $raw))
            ->map(fn (string $value): string => trim($value))
            ->filter(fn (string $value): bool => $enum::tryFrom($value) !== null)
            ->values()
            ->all();
    }

    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }
}
