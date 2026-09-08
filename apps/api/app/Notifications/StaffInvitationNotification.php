<?php

namespace App\Notifications;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Location;
use App\Models\UserInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly UserInvitation $invitation,
        public readonly string $token,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /** Branded template compiled from packages/mailing/emails/staff-invitation.vue. */
    public function toMail(object $notifiable): MailMessage
    {
        $accountName = $this->invitation->account->name;

        return (new MailMessage)
            ->subject("Te invitaron al equipo de {$accountName}")
            ->view('mail.maizzle.staff-invitation', [
                'firstName' => $this->invitation->first_name,
                'accountName' => $accountName,
                'invitedByName' => $this->invitation->invitedBy?->name,
                'roleLabel' => $this->roleLabel(),
                'locations' => $this->locationNames(),
                'claimUrl' => $this->claimUrl(),
                'expiresOn' => $this->invitation->expires_at->locale('es')->isoFormat('D [de] MMMM'),
            ]);
    }

    /**
     * Same wording as the admin app's role labels (roles.* in common.json).
     */
    private function roleLabel(): string
    {
        if ($this->invitation->invitedAccountRole() === AccountRole::AccountAdmin->value) {
            return 'Superadmin';
        }

        $roles = array_unique(array_column($this->invitation->invitedLocationAssignments(), 'role'));

        $labels = array_map(fn (string $role): string => match ($role) {
            LocationRole::LocationManager->value => 'Administrador',
            LocationRole::FrontDesk->value => 'Portería',
            default => $role,
        }, $roles);

        return $labels === [] ? 'Equipo' : implode(' · ', $labels);
    }

    /**
     * @return array<int, string>
     */
    private function locationNames(): array
    {
        $ids = array_column($this->invitation->invitedLocationAssignments(), 'location_id');

        if ($ids === []) {
            return [];
        }

        return Location::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->pluck('name')
            ->all();
    }

    private function claimUrl(): string
    {
        $template = (string) config('wasiy.invitations.staff_claim_url');

        return str_replace('{token}', $this->token, $template);
    }
}
