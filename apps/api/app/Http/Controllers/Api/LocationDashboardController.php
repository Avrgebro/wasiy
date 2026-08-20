<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\StaffLocationRole;
use Illuminate\Http\JsonResponse;

class LocationDashboardController extends Controller
{
    public function __invoke(Location $location): JsonResponse
    {
        return response()->json([
            'location' => [
                'id' => $location->id,
                'account_id' => $location->account_id,
                'name' => $location->name,
                'slug' => $location->slug,
                'timezone' => $location->timezone,
            ],
            'metrics' => [
                'assigned_staff_count' => StaffLocationRole::query()
                    ->whereBelongsTo($location)
                    ->whereHas('membership', fn ($query) => $query->whereNull('deactivated_at'))
                    ->distinct('staff_membership_id')
                    ->count('staff_membership_id'),
            ],
        ]);
    }
}
