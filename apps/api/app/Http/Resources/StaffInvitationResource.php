<?php

namespace App\Http\Resources;

use App\Models\UserInvitation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin UserInvitation
 */
class StaffInvitationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'user_id' => $this->user_id,
            'email' => $this->email,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'purpose' => $this->purpose->value,
            'status' => $this->status->value,
            'expires_at' => $this->expires_at?->toJSON(),
            'accepted_at' => $this->accepted_at?->toJSON(),
            'invited_by_user_id' => $this->invited_by_user_id,
        ];
    }
}
