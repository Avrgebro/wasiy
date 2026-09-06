<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Enums\Capability;
use App\Models\Announcement;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\SettingsResolver;

/**
 * Reading needs the capability. Posting needs it too, and the location's
 * "Location Managers can post" switch decides whether a manager gets past it;
 * account admins always do.
 */
class AnnouncementPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly SettingsResolver $settings,
    ) {}

    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageAnnouncements);
    }

    public function view(User $user, Announcement $announcement): bool
    {
        return $this->viewAny($user, $announcement->location);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->canPost($user, $location);
    }

    public function update(User $user, Announcement $announcement): bool
    {
        return $this->canPost($user, $announcement->location);
    }

    public function archive(User $user, Announcement $announcement): bool
    {
        return $this->canPost($user, $announcement->location);
    }

    private function canPost(User $user, Location $location): bool
    {
        if (! $this->access->can($user, $location, Capability::ManageAnnouncements)) {
            return false;
        }
        if ($this->access->hasAccountRole($user, $location->account, AccountRole::AccountAdmin)) {
            return true;
        }

        return $this->settings->forLocation($location)->announcementsLocationManagerCanPost;
    }
}
