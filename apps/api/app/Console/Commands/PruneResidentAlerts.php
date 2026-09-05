<?php

namespace App\Console\Commands;

use App\Models\ResidentAlert;
use Illuminate\Console\Command;

/** Read alerts are history nobody revisits; they leave after the retention window. Unread ones stay. */
class PruneResidentAlerts extends Command
{
    protected $signature = 'alerts:prune';

    protected $description = 'Delete read resident alerts older than the retention window';

    public function handle(): int
    {
        $deleted = ResidentAlert::query()
            ->whereNotNull('read_at')
            ->where('created_at', '<', now()->subDays((int) config('wasiy.alerts.retention_days')))
            ->delete();

        $this->info("Pruned {$deleted} alerts.");

        return self::SUCCESS;
    }
}
