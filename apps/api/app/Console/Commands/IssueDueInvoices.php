<?php

namespace App\Console\Commands;

use App\Actions\Billing\IssueInvoice;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use Illuminate\Console\Command;

class IssueDueInvoices extends Command
{
    protected $signature = 'invoices:issue';

    protected $description = 'Issue the next invoice for subscriptions whose access ends within the lead time';

    public function handle(IssueInvoice $issue): int
    {
        $issued = 0;

        Subscription::query()
            ->whereIn('status', [SubscriptionStatus::Trialing->value, SubscriptionStatus::Active->value])
            // By date, not timestamp: a trial ending at noon on the seventh day counts.
            ->whereDate('access_until', '<=', now()->addDays(IssueInvoice::LEAD_DAYS)->toDateString())
            ->orderBy('access_until')
            ->each(function (Subscription $subscription) use ($issue, &$issued): void {
                if ($issue->handle($subscription) !== null) {
                    $issued++;
                }
            });

        $this->info("Issued {$issued} invoice(s).");

        return self::SUCCESS;
    }
}
