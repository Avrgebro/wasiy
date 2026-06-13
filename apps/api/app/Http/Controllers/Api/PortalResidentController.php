<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityEventType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ResidentResource;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PortalResidentController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function updatePhone(Request $request): JsonResource
    {
        $validated = $request->validate([
            'phone' => ['present', 'nullable', 'string', 'max:255'],
            'first_name' => ['prohibited'],
            'last_name' => ['prohibited'],
            'email' => ['prohibited'],
            'name' => ['prohibited'],
            'status' => ['prohibited'],
            'resident_type' => ['prohibited'],
            'unit_id' => ['prohibited'],
            'unit_membership_id' => ['prohibited'],
            'is_primary_contact' => ['prohibited'],
            'memberships' => ['prohibited'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $resident = $this->access->residentForUser($user);

        abort_unless($resident && $this->access->activeResidentMembershipsForUser($user)->exists(), 403);

        $phoneBefore = $resident->phone;
        $resident->forceFill(['phone' => $validated['phone']])->save();

        if ($phoneBefore !== $resident->phone) {
            $membership = $this->access->activeResidentMembershipsForUser($user)
                ->with(['account', 'location'])
                ->first();

            $this->activityLogger->log(
                account: $resident->account,
                eventType: ActivityEventType::ResidentPhoneUpdated,
                summary: "{$resident->name} actualizó su teléfono en el portal de residentes.",
                metadata: [
                    'resident_id' => $resident->id,
                    'resident_name' => $resident->name,
                    'user_id' => $user->id,
                    'phone_before' => $phoneBefore,
                    'phone_after' => $resident->phone,
                ],
                location: $membership?->location,
                actor: $user,
                subjectType: 'resident',
                subjectId: $resident->id,
            );
        }

        return new ResidentResource($resident->loadSummary());
    }
}
