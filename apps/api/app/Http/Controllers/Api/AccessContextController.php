<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\AccessContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AccessContextController extends Controller
{
    public function __construct(
        private readonly AccessContextService $accessContext,
        private readonly AccessAuthorizationService $access,
    ) {}

    public function selectAccount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'account_id' => [
                'required',
                'string',
                'ulid',
                Rule::exists('accounts', 'id')->whereNull('deleted_at'),
            ],
        ]);

        /** @var User $user */
        $user = $request->user();

        /** @var Account $account */
        $account = Account::query()->findOrFail($validated['account_id']);

        abort_unless($this->access->canAccessAccount($user, $account), 403);

        return response()->json(
            $this->accessContext->selectAccount($user, $request, $account),
        );
    }

    public function selectLocation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'location_id' => [
                'required',
                'string',
                'ulid',
                Rule::exists('locations', 'id')->whereNull('deleted_at'),
            ],
        ]);

        /** @var User $user */
        $user = $request->user();

        abort_unless($this->accessContext->hasActiveAccount($request), 409, 'Select an active Account before selecting a Location.');

        $activeAccountId = $this->accessContext->activeAccountId($request);
        $activeAccount = $activeAccountId ? Account::query()->find($activeAccountId) : null;

        if (! $activeAccount instanceof Account || ! $this->access->canAccessAccount($user, $activeAccount)) {
            $this->accessContext->forget($request);
            abort(409, 'Select an active Account before selecting a Location.');
        }

        /** @var Location $location */
        $location = Location::query()->findOrFail($validated['location_id']);

        if ($location->account_id !== $activeAccount->id) {
            throw ValidationException::withMessages([
                'location_id' => __('The selected location is invalid for the active Account.'),
            ]);
        }

        abort_unless($this->access->canAccessLocation($user, $location), 403);

        return response()->json(
            $this->accessContext->selectLocation($user, $request, $location),
        );
    }

    public function clear(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(
            $this->accessContext->clear($request, $user),
        );
    }
}
