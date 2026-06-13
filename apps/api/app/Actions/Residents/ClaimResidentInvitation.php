<?php

namespace App\Actions\Residents;

use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\UserInvitationStatus;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\ActivityLogger;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ClaimResidentInvitation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(UserInvitation $invitation, string $password): UserInvitation
    {
        return DB::transaction(function () use ($invitation, $password): UserInvitation {
            $invitation = UserInvitation::query()
                ->with(['account', 'location', 'resident'])
                ->lockForUpdate()
                ->findOrFail($invitation->id);

            $resident = $invitation->resident;

            if (! $resident || $resident->status !== RegistryStatus::Active) {
                throw ValidationException::withMessages([
                    'token' => __('This resident invitation cannot be claimed.'),
                ]);
            }

            $user = User::query()->where('email', $invitation->email)->first();

            if ($user instanceof User && $resident->user_id !== $user->id) {
                throw ValidationException::withMessages([
                    'email' => __('This email already belongs to another user. Existing-user resident merge is not available yet.'),
                ]);
            }

            if (! $user instanceof User) {
                try {
                    $user = User::query()->create([
                        'first_name' => $invitation->first_name,
                        'last_name' => $invitation->last_name,
                        'email' => $invitation->email,
                        'password' => $password,
                    ]);
                } catch (UniqueConstraintViolationException) {
                    throw ValidationException::withMessages([
                        'email' => __('This email was registered by a concurrent request. Try again.'),
                    ]);
                }
            } else {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();
            }

            $resident->forceFill(['user_id' => $user->id])->save();

            $invitation->forceFill([
                'user_id' => $user->id,
                'status' => UserInvitationStatus::Accepted,
                'accepted_at' => now(),
            ])->save();

            $this->activityLogger->log(
                account: $invitation->account,
                eventType: ActivityEventType::ResidentClaimed,
                summary: "{$resident->name} activó su acceso al portal de residentes.",
                metadata: [
                    'resident_id' => $resident->id,
                    'resident_name' => $resident->name,
                    'resident_email' => $resident->email,
                    'user_id' => $user->id,
                    'user_email' => $user->email,
                    'invitation_id' => $invitation->id,
                    'invitation_email' => $invitation->email,
                ],
                location: $invitation->location,
                actor: $user,
                subjectType: 'resident',
                subjectId: $resident->id,
            );

            return $invitation->fresh(['resident.unitMemberships.unit', 'account', 'location']);
        });
    }
}
