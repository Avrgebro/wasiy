<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\LocationUserRole;
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
                'assigned_staff_count' => LocationUserRole::query()
                    ->whereBelongsTo($location)
                    ->distinct('user_id')
                    ->count('user_id'),
            ],
        ]);
    }
}
