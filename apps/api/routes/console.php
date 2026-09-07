<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('invitations:expire-stale')->daily();
Schedule::command('visits:auto-check-out')->everyTenMinutes();
Schedule::command('alerts:prune')->daily();
Schedule::command('announcements:publish-due')->everyMinute();
Schedule::command('horizon:snapshot')->everyFiveMinutes();
