<?php

namespace App\Actions\Announcements;

use App\Enums\ActivityEventType;
use App\Enums\ResidentAlertKind;
use App\Models\Announcement;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ResidentAlerts;
use App\Services\SettingsResolver;
use Illuminate\Support\Facades\DB;

/**
 * The moment a post goes live: stamp published_at, tell every resident of
 * the location (portal alert; email when the location switch is on), and
 * record the counts the detail drawer shows. Runs from the controller when
 * publish_at is now, and from announcements:publish-due for scheduled ones.
 */
class PublishAnnouncement
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly ResidentAlerts $alerts,
        private readonly SettingsResolver $settings,
    ) {}

    public function handle(Announcement $announcement, ?User $actor): Announcement
    {
        return DB::transaction(function () use ($announcement, $actor): Announcement {
            $announcement->loadMissing(['location.account', 'author']);
            $location = $announcement->location;
            $timezone = $location->timezone;

            $facts = array_values(array_filter([
                ['label' => 'Ubicación', 'value' => $location->name],
                $announcement->expires_on ? ['label' => 'Vigente hasta', 'value' => $announcement->expires_on->locale('es')->isoFormat('D [de] MMMM')] : null,
            ]));

            $result = $this->alerts->broadcast(
                location: $location,
                kind: ResidentAlertKind::AnnouncementPublished,
                title: $announcement->title,
                body: $announcement->excerpt,
                subject: $announcement,
                facts: $facts,
                intro: "Administración de {$location->name} publicó un anuncio.",
                actionLabel: 'Abrir el portal',
                actionPath: '/portal',
                email: $this->settings->forLocation($location)->announcementsEmailResidents,
            );

            $announcement->forceFill([
                'published_at' => now(),
                'notified_count' => $result['recipients'],
                'emailed_count' => $result['emails'],
            ])->save();

            $this->activityLogger->log(
                account: $location->account,
                eventType: ActivityEventType::AnnouncementPublished,
                summary: "Anuncio publicado: «{$announcement->title}» · {$result['recipients']} residente(s) notificado(s).",
                metadata: [
                    'announcement_id' => $announcement->id,
                    'title' => $announcement->title,
                    'is_important' => $announcement->is_important,
                    'expires_on' => $announcement->expires_on?->toDateString(),
                    'notified_count' => $result['recipients'],
                    'emailed_count' => $result['emails'],
                    'timezone' => $timezone,
                ],
                location: $location,
                actor: $actor ?? $announcement->author,
                subjectType: 'announcement',
                subjectId: $announcement->id,
            );

            return $announcement;
        });
    }
}
