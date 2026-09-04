<?php

namespace App\Console\Commands;

use App\Actions\Visits\CheckOutVisit;
use App\Enums\VisitStatus;
use App\Models\Location;
use App\Models\Visit;
use App\Services\SettingsResolver;
use Illuminate\Console\Command;

/**
 * Visitors often leave without telling anyone. Each location's operational
 * settings say how many hours a visit may stay open (0 = never); anything
 * older is closed with the automatic flag so the timeline says so.
 */
class AutoCheckOutVisits extends Command
{
    protected $signature = 'visits:auto-check-out';

    protected $description = 'Close visits still inside past each location\'s visitor_auto_checkout_hours';

    public function handle(SettingsResolver $settings, CheckOutVisit $checkOut): int
    {
        $closed = 0;

        Location::query()
            ->whereHas('visits', fn ($query) => $query->where('status', VisitStatus::Inside->value))
            ->each(function (Location $location) use ($settings, $checkOut, &$closed): void {
                $hours = $settings->forLocation($location)->visitorAutoCheckoutHours;
                if ($hours <= 0) {
                    return;
                }

                Visit::query()
                    ->where('location_id', $location->id)
                    ->where('status', VisitStatus::Inside->value)
                    ->where('checked_in_at', '<=', now()->subHours($hours))
                    ->each(function (Visit $visit) use ($checkOut, &$closed): void {
                        $checkOut->handle($visit, null, null, automatic: true);
                        $closed++;
                    });
            });

        $this->info("Closed {$closed} visit(s) automatically.");

        return self::SUCCESS;
    }
}
