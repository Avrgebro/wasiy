<?php

namespace App\Http\Controllers\Api;

use App\Actions\Reservations\BuildAvailability;
use App\Http\Controllers\Controller;
use App\Models\Amenity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Staff view of the day list (ADR 0043): the Nueva reserva drawer and the
 * week board read the same days the portal does instead of recomputing
 * them in the browser.
 */
class AmenityAvailabilityController extends Controller
{
    public function __invoke(Request $request, Amenity $amenity, BuildAvailability $availability): JsonResponse
    {
        Gate::authorize('viewAny', [Amenity::class, $amenity->location]);

        $validated = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d'],
            // Accepted for symmetry with the portal call; days are per amenity.
            'unit_id' => ['sometimes', 'nullable', 'string', 'ulid'],
        ]);

        return response()->json($availability->handle($amenity, $validated['from'], $validated['to']));
    }
}
