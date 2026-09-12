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
            ->when(($validated['scope'] ?? 'all') === 'pending', fn (Builder $query) => $query->where('status', MovementStatus::Pending->value))
            ->orderByDesc('occurred_on')->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (FinancialMovement $movement): array => $this->row($movement))
            ->all();

        $owed = (int) (clone $base)->where('status', MovementStatus::Pending->value)->sum('amount_minor');

        $lastDues = (clone $base)
            ->where('category', MovementCategory::MaintenanceDues->value)
            ->orderByDesc('occurred_on')->orderByDesc('created_at')
            ->first();

        return response()->json([
            'data' => $rows,
            'balance_minor' => $owed,
            'pending_count' => (clone $base)->where('status', MovementStatus::Pending->value)->count(),
            'last_dues' => $lastDues ? ['period' => $lastDues->period, 'amount_minor' => $lastDues->amount_minor, 'settled' => $lastDues->status !== MovementStatus::Pending] : null,
        ]);
    }

    /**
     * Pending reads as "Pendiente"; everything else the unit already
     * settled reads as "Pagado". A refunded deposit is money coming back,
     * shown negative.
     *
     * @return array<string, mixed>
     */
    private function row(FinancialMovement $movement): array
    {
        $refund = $movement->status === MovementStatus::Refunded;

        return [
            'id' => $movement->id,
            'concept' => $refund ? 'Depósito devuelto' : $movement->concept,
            'detail' => $movement->detail,
            'category' => $movement->category->value,
            'occurred_on' => $movement->occurred_on->toDateString(),
            'period' => $movement->period,
            'amount_minor' => $refund ? -$movement->amount_minor : $movement->amount_minor,
            'state' => $movement->status === MovementStatus::Pending ? 'pending' : 'paid',
        ];
    }
}
