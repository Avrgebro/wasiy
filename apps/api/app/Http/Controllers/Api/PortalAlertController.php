<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ResidentAlertResource;
use App\Models\ResidentAlert;
use App\Models\Unit;
use App\Services\AccessAuthorizationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * The bell (mockups 03/03b): my alerts for the active unit, newest first,
 * an unread count for the badge, and read marks one at a time or all at
 * once. Rows belong to the resident, so the list is theirs alone even when
 * a neighbour shares the unit.
 */
class PortalAlertController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            ...$this->paginationRules(),
            'unit_id' => ['required', 'string', 'ulid'],
            'scope' => ['sometimes', 'in:new,all'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAsResident', [ResidentAlert::class, $unit]);

        $alerts = $this->mine($request, $unit)
            ->when(($validated['scope'] ?? 'all') === 'new', fn (Builder $query) => $query->unread())
            ->orderByDesc('created_at')->orderByDesc('id');

        return ResidentAlertResource::collection($alerts->paginate($this->perPage($validated))->withQueryString());
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $validated = $request->validate(['unit_id' => ['required', 'string', 'ulid']]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAsResident', [ResidentAlert::class, $unit]);

        return response()->json(['unread' => $this->mine($request, $unit)->unread()->count()]);
    }

    public function markRead(ResidentAlert $alert): JsonResource
    {
        Gate::authorize('markRead', $alert);

        if ($alert->read_at === null) {
            $alert->forceFill(['read_at' => now()])->save();
        }

        return new ResidentAlertResource($alert);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $validated = $request->validate(['unit_id' => ['required', 'string', 'ulid']]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAsResident', [ResidentAlert::class, $unit]);

        $marked = $this->mine($request, $unit)->unread()->update(['read_at' => now()]);

        return response()->json(['marked' => $marked]);
    }

    /** @return Builder<ResidentAlert> */
    private function mine(Request $request, Unit $unit): Builder
    {
        $resident = $this->access->residentForUser($request->user());

        return ResidentAlert::query()
            ->where('unit_id', $unit->id)
            ->where('resident_id', $resident?->id ?? '');
    }
}
