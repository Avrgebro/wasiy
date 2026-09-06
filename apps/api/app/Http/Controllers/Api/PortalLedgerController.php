<?php

namespace App\Http\Controllers\Api;

use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Http\Controllers\Controller;
use App\Models\FinancialMovement;
use App\Models\Unit;
use App\Models\UnitMembership;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Estado de cuenta (Portal 04f), primary contact only. The unit's charges
 * from the ledger, read as a resident: what is owed and what was paid,
 * refunds as negative rows. The portal informs, it never collects.
 */
class PortalLedgerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'unit_id' => ['required', 'string', 'ulid'],
            'scope' => ['sometimes', 'in:pending,all'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('manageHousehold', [UnitMembership::class, $unit]);

        $base = FinancialMovement::query()
            ->where('unit_id', $unit->id)
            ->where('direction', MovementDirection::Income->value)
            ->where('status', '!=', MovementStatus::Voided->value);

        $rows = (clone $base)
            ->when(($validated['scope'] ?? 'all') === 'pending', fn (Builder $query) => $query->whereIn('status', [MovementStatus::Pending->value, MovementStatus::ToRefund->value]))
            ->orderByDesc('occurred_on')->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (FinancialMovement $movement): array => $this->row($movement))
            ->all();

        $owed = (int) (clone $base)->where('status', MovementStatus::Pending->value)->sum('amount');
        $toRefund = (int) (clone $base)->where('status', MovementStatus::ToRefund->value)->sum('amount');

        $lastDues = (clone $base)
            ->where('category', MovementCategory::MaintenanceDues->value)
            ->orderByDesc('occurred_on')->orderByDesc('created_at')
            ->first();

        return response()->json([
            'data' => $rows,
            'balance' => $owed - $toRefund,
            'pending_count' => (clone $base)->whereIn('status', [MovementStatus::Pending->value, MovementStatus::ToRefund->value])->count(),
            'last_dues' => $lastDues ? ['period' => $lastDues->period, 'amount' => $lastDues->amount, 'settled' => $lastDues->status !== MovementStatus::Pending] : null,
        ]);
    }

    /**
     * Pending and to-refund read as "Pendiente"; everything else the unit
     * already settled reads as "Pagado". Money coming back is negative.
     *
     * @return array<string, mixed>
     */
    private function row(FinancialMovement $movement): array
    {
        $refund = in_array($movement->status, [MovementStatus::Refunded, MovementStatus::ToRefund], true);

        return [
            'id' => $movement->id,
            'concept' => $refund ? 'Depósito devuelto' : $movement->concept,
            'detail' => $movement->detail,
            'category' => $movement->category->value,
            'occurred_on' => $movement->occurred_on->toDateString(),
            'period' => $movement->period,
            'amount' => $refund ? -$movement->amount : $movement->amount,
            'state' => in_array($movement->status, [MovementStatus::Pending, MovementStatus::ToRefund], true) ? 'pending' : 'paid',
        ];
    }
}
