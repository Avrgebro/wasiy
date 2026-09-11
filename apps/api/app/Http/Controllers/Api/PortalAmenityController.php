<?php

namespace App\Http\Controllers\Api;

use App\Actions\Reservations\BuildAvailability;
use App\Http\Controllers\Controller;
use App\Http\Resources\AmenityResource;
use App\Models\Amenity;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * Resident-facing amenities (portal P2): what can be booked in my location,
 * and which slots are free on a given day. Slots come from BuildAvailability,
 * the same list staff read, so the portal never offers a time the API would
 * refuse.
 */
class PortalAmenityController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate(['unit_id' => ['required', 'string', 'ulid']]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAnyAsResident', [Amenity::class, $unit->location]);

        $amenities = Amenity::query()
            ->where('location_id', $unit->location_id)
            ->whereNull('deactivated_at')
            ->where('is_reservable', true)
            ->with('photos')
            ->orderBy('name')
            ->get();

        return AmenityResource::collection($amenities);
    }

    /** The slots of one day, in the location's timezone; only past ones are unavailable (ADR 0041). */
    public function availability(Request $request, Amenity $amenity, BuildAvailability $availability): JsonResponse
    {
        $validated = $request->validate([
            'unit_id' => ['required', 'string', 'ulid'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewAnyAsResident', [Amenity::class, $amenity->location]);
        abort_unless($unit->location_id === $amenity->location_id, 404);

        return response()->json($availability->handle($amenity, $validated['date']));
    }
}
