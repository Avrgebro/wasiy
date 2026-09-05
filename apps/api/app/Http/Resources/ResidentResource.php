<?php

namespace App\Http\Resources;

use App\Models\Resident;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Resident
 */
class ResidentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'user_id' => $this->user_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'phone' => $this->phone,
            // Front desk sees phones, never emails (M11). The person always sees their own.
            'email' => $this->when($this->emailVisibleTo($request->user()), $this->email),
            'email_alerts' => $this->when($request->user()?->id === $this->user_id, fn () => $this->emailAlerts()),
            'login_email' => $this->when($request->user()?->id === $this->user_id, fn () => $request->user()->email),
            'status' => $this->status->value,
            'portal_state' => $this->portalState(),
            'active_membership_count' => $this->relationLoaded('unitMemberships')
                ? $this->unitMemberships->where('status', 'active')->count()
                : $this->unitMemberships()->active()->count(),
            'memberships' => UnitMembershipResource::collection($this->whenLoaded('unitMemberships')),
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }

    private function emailVisibleTo(?User $user): bool
    {
        if ($user === null) {
            return false;
        }
        if ($this->user_id === $user->id) {
            return true;
        }

        return app(AccessAuthorizationService::class)->canManageAnyRegistryInAccount($user, $this->account);
    }

    /** active = has a portal user; invited = a pending invitation; not_invited otherwise. */
    private function portalState(): string
    {
        if ($this->user_id !== null) {
            return 'active';
        }
        $pending = $this->relationLoaded('userInvitations')
            ? $this->userInvitations->contains(fn ($invitation) => $invitation->status === 'pending')
            : $this->userInvitations()->where('status', 'pending')->exists();

        return $pending ? 'invited' : 'not_invited';
    }
}
