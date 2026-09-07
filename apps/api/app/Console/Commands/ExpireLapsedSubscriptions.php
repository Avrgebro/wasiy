<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use Illuminate\Console\Command;

class ExpireLapsedSubscriptions extends Command
{
    protected $signature = 'subscriptions:expire-lapsed';

    protected $description = 'Mark trialing or active subscriptions whose access_until has passed as expired';

    public function handle(): int
    {
        $expired = Subscription::query()
            ->lapsedButNotExpired()
            ->update(['status' => SubscriptionStatus::Expired->value]);

        $this->info("Expired {$expired} lapsed subscription(s).");

        return self::SUCCESS;
    }
}
