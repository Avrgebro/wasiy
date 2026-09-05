<?php

namespace App\Http\Controllers\Api;

use App\Enums\Capability;
use App\Enums\PackageStatus;
use App\Enums\RegistryStatus;
use App\Enums\VisitStatus;
use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\Package;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\Visit;
use App\Services\AccessAuthorizationService;
use App\Support\PhoneNumber;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * The spotlight (⌘K): one term fanned across the location's registries, a
 * few hits per group, each with where to go. Groups appear only when the
 * caller holds the capability that opens their page (ADR 0036), so the
 * desk gets people and its logs, never the ledger. Pages themselves are
 * matched on the client from the nav tree.
 */
class LocationSearchController extends Controller
{
    private const PER_GROUP = 5;

    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function __invoke(Request $request, Location $location): JsonResponse
    {
        Gate::authorize('view', $location);
        $validated = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);
        $term = trim($validated['q']);
        $user = $request->user();
        $can = fn (Capability $capability): bool => $this->access->can($user, $location, $capability);

        $groups = [];

        if ($can(Capability::ManageRegistry)) {
            $groups[] = ['key' => 'units', 'items' => $this->units($location, $term)];
        }
        if ($can(Capability::ViewRegistry)) {
            $groups[] = ['key' => 'residents', 'items' => $this->residents($location, $term)];
        }
        if ($can(Capability::ManageReception)) {
            $groups[] = ['key' => 'visits', 'items' => $this->visits($location, $term)];
            $groups[] = ['key' => 'packages', 'items' => $this->packages($location, $term)];
        }

        return response()->json([
            'q' => $term,
            'groups' => array_values(array_filter($groups, fn (array $group): bool => $group['items'] !== [])),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function units(Location $location, string $term): array
    {
        return Unit::query()
            ->where('location_id', $location->id)
            ->where(fn (Builder $group) => $group
                ->searchIdentity($term)
                ->orWhere(fn (Builder $labels) => $labels->searchLike(['parking_spots', 'storage_rooms'], $term))
                ->orWhereHas('vehicles', fn (Builder $vehicle) => $vehicle->searchLike(['plate'], $term)))
            ->with(['primaryContactMembership.resident', 'vehicles'])
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByBuilding()->orderBy('unit_number')
            ->limit(self::PER_GROUP)
            ->get()
            ->map(function (Unit $unit) use ($term): array {
                $plate = $unit->vehicles->first(fn ($vehicle) => str_contains(mb_strtolower($vehicle->plate), mb_strtolower($term)))?->plate;

                return [
                    'id' => $unit->id,
                    'label' => $unit->label(),
                    'description' => $plate ?? $unit->primaryContactMembership?->resident?->name ?? ($unit->status === RegistryStatus::Active ? null : 'Inactiva'),
                    'to' => ['page' => 'unit', 'unit_id' => $unit->id],
                ];
            })
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function residents(Location $location, string $term): array
    {
        return Resident::query()
            ->whereHas('unitMemberships', fn (Builder $membership) => $membership
                ->where('location_id', $location->id)
                ->where('status', RegistryStatus::Active->value))
            ->where(fn (Builder $who) => $who
                ->searchLike(['first_name', 'last_name', "first_name || ' ' || last_name"], $term)
                ->when(PhoneNumber::digits($term) !== '', fn (Builder $phones) => $phones->orWhere('phone', 'like', '%'.PhoneNumber::digits($term).'%')))
            ->with(['unitMemberships' => fn ($query) => $query
                ->where('location_id', $location->id)
                ->where('status', RegistryStatus::Active->value)
                ->with('unit')])
            ->orderBy('last_name')->orderBy('first_name')
            ->limit(self::PER_GROUP)
            ->get()
            ->map(fn (Resident $resident): array => [
                'id' => $resident->id,
                'label' => $resident->name,
                'description' => $resident->unitMemberships->map(fn ($membership) => $membership->unit->label())->join(' · ') ?: null,
                'to' => ['page' => 'resident', 'resident_id' => $resident->id],
            ])
            ->all();
    }

    /**
     * Inside first, then anyone who came today.
     *
     * @return list<array<string, mixed>>
     */
    private function visits(Location $location, string $term): array
    {
        $startOfToday = CarbonImmutable::now($location->timezone)->startOfDay()->utc();

        return Visit::query()
            ->where('location_id', $location->id)
            ->where(fn (Builder $scope) => $scope
                ->where('status', VisitStatus::Inside->value)
                ->orWhere('checked_in_at', '>=', $startOfToday))
            ->where(fn (Builder $group) => $group
                ->searchLike(['visitor_name', 'document'], $term)
                ->orWhereHas('unit', fn (Builder $unit) => $unit->searchLike(['unit_number'], $term)))
            ->with('unit')
            ->orderByRaw("CASE WHEN status = 'inside' THEN 0 ELSE 1 END")
            ->orderByDesc('checked_in_at')
            ->limit(self::PER_GROUP)
            ->get()
            ->map(fn (Visit $visit): array => [
                'id' => $visit->id,
                'label' => $visit->visitor_name,
                'description' => $visit->unit->label().($visit->status === VisitStatus::Inside ? ' · dentro' : ''),
                'to' => ['page' => 'visit', 'visit_id' => $visit->id],
            ])
            ->all();
    }

    /**
     * Pending only: a delivered package is history, not something to find.
     *
     * @return list<array<string, mixed>>
     */
    private function packages(Location $location, string $term): array
    {
        return Package::query()
            ->where('location_id', $location->id)
            ->where('status', PackageStatus::Pending->value)
            ->where(fn (Builder $group) => $group
                ->searchLike(['notes'], $term)
                ->orWhereHas('unit', fn (Builder $unit) => $unit->searchLike(['unit_number'], $term))
                ->orWhereHas('resident', fn (Builder $resident) => $resident->searchLike(["first_name || ' ' || last_name"], $term)))
            ->with(['unit', 'resident'])
            ->orderBy('received_at')
            ->limit(self::PER_GROUP)
            ->get()
            ->map(fn (Package $package): array => [
                'id' => $package->id,
                'label' => $package->resident?->name ?? $package->unit->label(),
                'description' => $package->resident ? $package->unit->label().($package->notes ? " · {$package->notes}" : '') : $package->notes,
                'to' => ['page' => 'package', 'package_id' => $package->id],
            ])
            ->all();
    }
}
