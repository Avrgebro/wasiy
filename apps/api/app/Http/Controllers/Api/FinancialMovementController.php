<?php

namespace App\Http\Controllers\Api;

use App\Actions\Finances\RecordMovement;
use App\Actions\Finances\TransitionMovement;
use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFinancialMovementRequest;
use App\Http\Resources\FinancialMovementResource;
use App\Models\Account;
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
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query
                ->searchLike(['concept', 'detail', 'counterparty'], $search))
            ->with(self::RELATIONS);

        SortParser::apply($movements, $validated['sort'] ?? null, [
            'occurred_on' => 'occurred_on',
            'amount' => 'amount',
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
        $toRefund = $base()->where('status', MovementStatus::ToRefund->value);

        $incomeTotal = (int) $income->clone()->sum('amount');
        $expenseTotal = (int) $expense->clone()->sum('amount');

        return response()->json(['data' => [
            'month' => $month,
            'income_total' => $incomeTotal,
            'income_count' => $income->count(),
            'expense_total' => $expenseTotal,
            'expense_count' => $expense->count(),
            'balance' => $incomeTotal - $expenseTotal,
            'receivable_total' => (int) $receivable->clone()->sum('amount'),
            'receivable_count' => $receivable->count(),
            'payable_total' => (int) $payable->clone()->sum('amount'),
            'payable_count' => $payable->count(),
            'deposits_held_total' => (int) $held->sum('amount'),
            'deposits_to_refund_total' => (int) $toRefund->clone()->sum('amount'),
            'deposits_to_refund_count' => $toRefund->count(),
        ]]);
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
