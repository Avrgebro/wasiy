<?php

namespace App\Console\Commands;

use App\Actions\Announcements\PublishAnnouncement;
use App\Models\Announcement;
use Illuminate\Console\Command;

/**
 * Scheduled posts go live from here, once a minute: anything whose publish
 * time has arrived and that was neither published nor archived is fanned
 * out exactly as an immediate post would have been.
 */
class PublishDueAnnouncements extends Command
{
    protected $signature = 'announcements:publish-due';

    protected $description = 'Publish scheduled announcements whose publish_at has arrived';

    public function handle(PublishAnnouncement $publish): int
    {
        $published = 0;

        Announcement::query()
            ->whereNull('published_at')
            ->whereNull('archived_at')
            ->where('publish_at', '<=', now())
            ->orderBy('publish_at')
            ->each(function (Announcement $announcement) use ($publish, &$published): void {
                $publish->handle($announcement, null);
                $published++;
            });

        $this->info("Published {$published} announcement(s).");

        return self::SUCCESS;
    }
}
