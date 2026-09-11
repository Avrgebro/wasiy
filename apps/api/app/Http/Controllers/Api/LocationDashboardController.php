<?php

namespace App\Http\Controllers\Api;

use App\Enums\Capability;
use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Enums\PackageStatus;
use App\Enums\RegistryStatus;
use App\Enums\VisitStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PackageResource;
use App\Http\Resources\ReservationResource;
use App\Http\Resources\VisitResource;
use App\Models\ActivityLog;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Package;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\Visit;
use App\Services\AccessAuthorizationService;
use App\Services\SettingsResolver;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Panel (mockups 17/17b). One response, two strips: `today` is the
 * operational board every staff member sees; `management` carries finances,
 * occupancy and the activity feed and is omitted entirely — not nulled — for
 * callers who cannot manage the registry, so the front desk never receives
 * a financial figure.
 *
 * Every number here is a statistic (docs: kpis-purely-statistical); the
 * client renders them without interpretive copy.
 */
class LocationDashboardController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly SettingsResolver $settings,
    ) {}

    public function __invoke(Request $request, Location $location): JsonResponse
    {
        $user = $request->user();

        $payload = [
            'location' => [
                'id' => $location->id,
                'account_id' => $location->account_id,
                'name' => $location->name,
                'slug' => $location->slug,
                'timezone' => $location->timezone,
            ],
            'today' => $this->today($location),
        ];

        if ($user !== null && $this->access->can($user, $location, Capability::ManageFinances)) {
            $payload['management'] = $this->management($location);
        }

        return response()->json($payload);
    }

    /**
     * @return array<string, mixed>
     */
    private function today(Location $location): array
    {
        $now = CarbonImmutable::now($location->timezone);
        [$dayStart, $dayEnd] = [$now->startOfDay()->utc(), $now->endOfDay()->utc()];

        // Same threshold the scheduled command applies; 0 means visits never
        // go stale, so nothing is flagged.
        $hours = $this->settings->forLocation($location)->visitorAutoCheckoutHours;
        $overdueBefore = $hours > 0 ? now()->subHours($hours) : null;

        $inside = Visit::query()
            ->where('location_id', $location->id)
            ->where('status', VisitStatus::Inside->value);

        $insideVisits = $inside->clone()
            ->with(['unit', 'resident'])
            ->orderBy('checked_in_at') // longest stays first: they need attention
            ->limit(5)
            ->get();

        $pendingPackages = Package::query()
            ->where('location_id', $location->id)
            ->where('status', PackageStatus::Pending->value);

        $reservations = Reservation::query()
            ->where('location_id', $location->id)
            ->whereIn('status', ['pending', 'observed', 'approved'])
            ->whereBetween('starts_at', [$dayStart, $dayEnd]);

        // min() hands back the driver's raw string; the client needs ISO.
        $oldestPackage = $pendingPackages->clone()->min('received_at');

        return [
            'date' => $now->toDateString(),
            'visitors_inside_count' => $inside->clone()->count(),
            'visitors_overdue_count' => $overdueBefore === null
                ? 0
                : $inside->clone()->where('checked_in_at', '<=', $overdueBefore)->count(),
            'visitors_inside' => $insideVisits
                ->map(fn (Visit $visit): array => [
                    ...(new VisitResource($visit))->resolve(),
                    'is_overdue' => $overdueBefore !== null && $visit->checked_in_at->lte($overdueBefore),
                ])
                ->all(),
            'exits_today_count' => Visit::query()
                ->where('location_id', $location->id)
                ->where('status', VisitStatus::Left->value)
                ->whereBetween('checked_out_at', [$dayStart, $dayEnd])
                ->count(),
            'packages_pending_count' => $pendingPackages->clone()->count(),
            'packages_oldest_received_at' => $oldestPackage ? CarbonImmutable::parse($oldestPackage)->toJSON() : null,
            'packages_pending' => PackageResource::collection(
                $pendingPackages->clone()
                    ->with(['unit', 'resident'])
                    ->orderBy('received_at')
                    ->limit(5)
                    ->get(),
            )->resolve(),
            'reservations_today_count' => $reservations->clone()->count(),
            'reservations_with_deposit_count' => $reservations->clone()->where('deposit_snapshot_minor', '>', 0)->count(),
            'reservations_today' => ReservationResource::collection(
                $reservations->clone()
                    ->with(['amenity', 'unit', 'resident'])
                    ->orderBy('starts_at')
                    ->get(),
            )->resolve(),
            'pending_movements_count' => FinancialMovement::query()
                ->where('location_id', $location->id)
                ->where('status', MovementStatus::Pending->value)
                ->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function management(Location $location): array
    {
        $month = CarbonImmutable::now($location->timezone)->format('Y-m');

        $dues = FinancialMovement::query()
            ->where('location_id', $location->id)
            ->where('category', MovementCategory::MaintenanceDues->value)
            ->where('period', $month)
            ->where('status', '!=', MovementStatus::Voided->value);

        $held = FinancialMovement::query()
            ->where('location_id', $location->id)
            ->where('status', MovementStatus::Held->value);

        $activeUnits = Unit::query()
            ->where('location_id', $location->id)
            ->where('status', RegistryStatus::Active->value);

        $occupied = $activeUnits->clone()->whereHas('activeUnitMemberships');

        $activity = ActivityLog::query()
            ->where('location_id', $location->id)
            ->with('actor')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->limit(6)
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'event_type' => $entry->event_type->value,
                'summary' => $entry->summary,
                'actor_name' => $entry->actor?->name,
                'created_at' => $entry->created_at?->toJSON(),
            ])
            ->all();

        return [
            'month' => $month,
            'dues_issued_total_minor' => (int) $dues->clone()->sum('amount_minor'),
            'dues_collected_total_minor' => (int) $dues->clone()->where('status', MovementStatus::Paid->value)->sum('amount_minor'),
            'units_with_balance_count' => FinancialMovement::query()
                ->where('location_id', $location->id)
                ->where('direction', MovementDirection::Income->value)
                ->where('status', MovementStatus::Pending->value)
                ->whereNotNull('unit_id')
                ->distinct('unit_id')
                ->count('unit_id'),
            'deposits_held_total_minor' => (int) $held->clone()->sum('amount_minor'),
            'deposits_held_count' => $held->clone()->count(),
            'residents_not_invited_count' => Resident::query()
                ->where('status', RegistryStatus::Active->value)
                ->whereNull('user_id')
                ->whereHas('unitMemberships', fn (Builder $membership) => $membership
                    ->where('location_id', $location->id)
                    ->where('status', RegistryStatus::Active->value))
                ->whereDoesntHave('userInvitations', fn (Builder $invitation) => $invitation->where('status', 'pending'))
                ->count(),
            'units_total' => $activeUnits->clone()->count(),
            'units_occupied' => $occupied->clone()->count(),
            'units_vacant' => $activeUnits->clone()->whereDoesntHave('activeUnitMemberships')->count(),
            'units_without_primary_contact' => $occupied->clone()->whereDoesntHave('primaryContactMembership')->count(),
            'activity' => $activity,
        ];
    }
}
