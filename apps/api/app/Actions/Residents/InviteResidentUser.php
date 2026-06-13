<?php

namespace App\Actions\Residents;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Location;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\ResidentInvitationNotification;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InviteResidentUser
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array{email?: string|null}  $data
     * @return array{resident: Resident, invitation: UserInvitation}
     */
    public function handle(Resident $resident, User $actor, array $data): array
    {
        return DB::transaction(function () use ($resident, $actor, $data): array {
            $resident->loadMissing(['account', 'unitMemberships.location']);

            if ($resident->status !== RegistryStatus::Active) {
                throw ValidationException::withMessages([
                    'resident' => __('Inactive residents cannot be invited to the portal.'),
                ]);
            }

            if ($resident->user_id !== null) {
                throw ValidationException::withMessages([
                    'resident' => __('This resident already has portal access.'),
                ]);
            }

            $location = $this->manageableInvitationLocation($resident, $actor);

            if (! $location) {
                abort(403);
            }

            $email = $data['email'] ?? $resident->email;

            if (! is_string($email) || trim($email) === '') {
                throw ValidationException::withMessages([
                    'email' => __('An invitation email is required for this resident.'),
                ]);
            }

            $email = Str::lower(trim($email));

            UserInvitation::query()
                ->where('account_id', $resident->account_id)
                ->where('email', $email)
                ->where('purpose', UserInvitationPurpose::Resident->value)
                ->where('status', UserInvitationStatus::Pending->value)
                ->where('expires_at', '<=', now())
                ->update(['status' => UserInvitationStatus::Expired->value]);

            $pendingInvitationExists = UserInvitation::query()
                ->where('account_id', $resident->account_id)
                ->where('email', $email)
                ->where('purpose', UserInvitationPurpose::Resident->value)
                ->where('status', UserInvitationStatus::Pending->value)
                ->exists();

            if ($pendingInvitationExists) {
                throw ValidationException::withMessages([
                    'email' => __('This email already has a pending resident invitation for this account.'),
                ]);
            }

            $token = Str::random(64);
            $expiresDays = max(1, (int) config('wasiy.invitations.resident_expires_days', 14));

            try {
                $invitation = UserInvitation::query()->create([
                    'account_id' => $resident->account_id,
                    'location_id' => $location->id,
                    'user_id' => null,
                    'resident_id' => $resident->id,
                    'email' => $email,
                    'first_name' => $resident->first_name,
                    'last_name' => $resident->last_name,
                    'token_hash' => hash('sha256', $token),
                    'purpose' => UserInvitationPurpose::Resident,
                    'status' => UserInvitationStatus::Pending,
                    'expires_at' => now()->addDays($expiresDays),
                    'accepted_at' => null,
                    'invited_by_user_id' => $actor->id,
                ]);
            } catch (UniqueConstraintViolationException) {
                throw ValidationException::withMessages([
                    'email' => __('This email already has a pending resident invitation for this account.'),
                ]);
            }

            $this->activityLogger->log(
                account: $resident->account,
                eventType: ActivityEventType::ResidentInvited,
                summary: "Se invitó a {$resident->name} al portal de residentes.",
                metadata: [
                    'actor_user_id' => $actor->id,
                    'actor_user_name' => $actor->name,
                    'actor_user_email' => $actor->email,
                    'resident_id' => $resident->id,
                    'resident_name' => $resident->name,
                    'resident_email' => $resident->email,
                    'invitation_id' => $invitation->id,
                    'invitation_email' => $email,
                    'location_id' => $location->id,
                    'location_name' => $location->name,
                ],
                location: $location,
                actor: $actor,
                subjectType: 'resident',
                subjectId: $resident->id,
            );

            Notification::route('mail', $email)
                ->notify(new ResidentInvitationNotification($invitation, $token));

            return [
                'resident' => $resident->fresh()->loadSummary(),
                'invitation' => $invitation,
            ];
        });
    }

    private function manageableInvitationLocation(Resident $resident, User $actor): ?Location
    {
        $location = $resident->unitMemberships()
            ->whereHas('location')
            ->where('account_id', $resident->account_id)
            ->where('status', RegistryStatus::Active)
            ->with('location')
            ->get()
            ->pluck('location')
            ->filter(fn (?Location $location): bool => $location !== null && $this->access->canManageResidentInLocation($actor, $resident, $location))
            ->first();

        if ($location instanceof Location) {
            return $location;
        }

        if ($this->access->hasAccountRole($actor, $resident->account, AccountRole::AccountAdmin)) {
            return $resident->unitMemberships()
                ->whereHas('location')
                ->where('account_id', $resident->account_id)
                ->with('location')
                ->first()
                ?->location;
        }

        return null;
    }
}
