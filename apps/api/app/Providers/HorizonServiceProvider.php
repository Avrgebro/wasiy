<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\Horizon;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        parent::boot();

        // Horizon::routeSmsNotificationsTo('15556667777');
        // Horizon::routeMailNotificationsTo('example@example.com');
        // Horizon::routeSlackNotificationsTo('slack-webhook-url', '#channel');
    }

    /**
     * Register the Horizon gate.
     *
     * This gate determines who can access Horizon in non-local environments.
     */
    protected function gate(): void
    {
        // Horizon is an operator tool, not a tenant feature, so access is an
        // allow-list of emails from the environment rather than a Capability.
        Gate::define('viewHorizon', function ($user = null) {
            $allowed = array_filter(array_map('trim', explode(',', (string) config('horizon.allowed_emails'))));

            return $user !== null && in_array(strtolower($user->email), array_map('strtolower', $allowed), true);
        });
    }
}
