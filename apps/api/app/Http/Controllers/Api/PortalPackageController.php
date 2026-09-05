<?php

namespace App\Http\Controllers\Api;

use App\Enums\PackageStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PackageResource;
use App\Models\Package;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/** Resident-facing, read-only: what is waiting at the desk for my unit, and what was delivered. */
class PortalPackageController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            ...$this->paginationRules(),
            'unit_id' => ['required', 'string', 'ulid'],
            'status' => ['sometimes', 'nullable', 'in:pending,delivered'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAsResident', [Package::class, $unit]);

        $packages = Package::query()
            ->where('unit_id', $unit->id)
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->with(['unit', 'resident'])
            ->orderByRaw("CASE WHEN status = '".PackageStatus::Pending->value."' THEN 0 ELSE 1 END")
            ->orderByDesc('received_at');

        return PackageResource::collection($packages->paginate($this->perPage($validated))->withQueryString());
    }
}
