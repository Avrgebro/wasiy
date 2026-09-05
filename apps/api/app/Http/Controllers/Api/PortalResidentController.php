<?php

namespace App\Http\Controllers\Api;

use App\Enums\ActivityEventType;
use App\Enums\ResidentAlertFamily;
use App\Http\Controllers\Controller;
use App\Http\Resources\ResidentResource;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use App\Support\PhoneNumber;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PortalResidentController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
    ) {}

    /** Me as a resident: name, phone, login email and email switches (mockup 03c). */
    public function show(Request $request): JsonResource
    {
        $resident = $this->access->residentForUser($request->user());
        abort_unless($resident && $this->access->activeResidentMembershipsForUser($request->user())->exists(), 403);

        return new ResidentResource($resident->loadSummary());
    }

    public function updateEmailAlerts(Request $request): JsonResource
    {
        $resident = $this->access->residentForUser($request->user());
        abort_unless($resident && $this->access->activeResidentMembershipsForUser($request->user())->exists(), 403);

        $validated = $request->validate(
            collect(ResidentAlertFamily::cases())
                ->mapWithKeys(fn (ResidentAlertFamily $family) => [$family->value => ['required', 'boolean']])
                ->all(),
        );

        $resident->forceFill(['email_alerts' => [...$resident->emailAlerts(), ...$validated]])->save();

        return new ResidentResource($resident->loadSummary());
    }

    public function updatePhone(Request $request): JsonResource
    {
        // The prohibited rules are contract, not paranoia: tests pin that
        // sending any other resident field here is a 422, so partial-update
        // clients fail loudly instead of having fields silently ignored.
        $resident = $this->access->residentForUser($request->user());
        $validated = $request->validate([
            'phone' => ['present', ...PhoneNumber::rules($resident?->phoneCountry() ?? PhoneNumber::FALLBACK_COUNTRY)],
            'first_name' => ['prohibited'],
            'last_name' => ['prohibited'],
            'email' => ['prohibited'],
            'name' => ['prohibited'],
            'status' => ['prohibited'],
            'unit_id' => ['prohibited'],
            'unit_membership_id' => ['prohibited'],
            'is_primary_contact' => ['prohibited'],
            'memberships' => ['prohibited'],
        ]);

        /** @var User $user */
        $user = $request->user();

        abort_unless($resident && $this->access->activeResidentMembershipsForUser($user)->exists(), 403);

        $phoneBefore = $resident->phone;
        $resident->forceFill(['phone' => PhoneNumber::normalize($validated['phone'], $resident->phoneCountry())])->save();

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
