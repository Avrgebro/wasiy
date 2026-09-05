<?php

namespace App\Http\Controllers\Api;

use App\Actions\Locations\UpdateOperationalSettings;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateOperationalSettingsRequest;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\SettingsResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class LocationSettingsController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly SettingsResolver $resolver,
    ) {}

    public function show(Request $request, Account $account, Location $location): JsonResponse
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('viewSettings', $location);

        return $this->settingsResponse($location);
    }

    public function update(
        UpdateOperationalSettingsRequest $request,
        Account $account,
        Location $location,
        UpdateOperationalSettings $updateSettings,
    ): JsonResponse {
        $this->authorizeAccount($request, $account);
        Gate::authorize('updateSettings', $location);

        /** @var User $actor */
        $actor = $request->user();

        $updateSettings->handle($location, $actor, $request->validated());

        return $this->settingsResponse($location->refresh());
    }

    /**
     * Effective values plus, per key, where each came from and what the
     * Account level would have given — the Configuración tab renders its
     * inheritance lines straight from this.
     */
    private function settingsResponse(Location $location): JsonResponse
    {
        return $this->dataResponse([
            'values' => $this->resolver->forLocation($location)->toArray(),
            'explanation' => $this->resolver->explain($location),
        ]);
    }

    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }
}
