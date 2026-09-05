<?php

namespace App\Http\Controllers\Api;

use App\Actions\Locations\UpdateOperationalSettings;
use App\Data\OperationalSettings;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateOperationalSettingsRequest;
use App\Models\Account;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\SettingsResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AccountSettingsController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly SettingsResolver $resolver,
    ) {}

    public function show(Request $request, Account $account): JsonResponse
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('manageSettings', $account);

        return $this->settingsResponse($account);
    }

    public function update(
        UpdateOperationalSettingsRequest $request,
        Account $account,
        UpdateOperationalSettings $updateSettings,
    ): JsonResponse {
        $this->authorizeAccount($request, $account);
        Gate::authorize('manageSettings', $account);

        /** @var User $actor */
        $actor = $request->user();

        $updateSettings->handle($account, $actor, $request->validated());

        return $this->settingsResponse($account->refresh());
    }

    /**
     * The Account level has no parent, so the explanation degenerates to
     * override-or-default — same shape as the Location payload minus
     * account_value, so one frontend component renders both.
     */
    private function settingsResponse(Account $account): JsonResponse
    {
        $overrides = $account->settings ?? [];
        $values = $this->resolver->forAccount($account)->toArray();

        $explanation = [];
        foreach (array_keys(OperationalSettings::DEFAULTS) as $key) {
            $explanation[$key] = [
                'value' => $values[$key],
                'source' => array_key_exists($key, $overrides) ? 'account' : 'default',
            ];
        }

        return $this->dataResponse([
            'values' => $values,
            'explanation' => $explanation,
        ]);
    }

    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }
}
