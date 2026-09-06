<?php

namespace App\Http\Controllers\Api;

use App\Actions\Invitations\ResendUserInvitation;
use App\Actions\Registry\CreateUnitMembership;
use App\Actions\Residents\InviteResidentUser;
use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Enums\UserInvitationStatus;
use App\Http\Controllers\Controller;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Mi hogar (Portal 04): who lives in the unit. Every member reads the list;
 * the primary contact adds people, removes them and re-sends invitations.
 * Adding reuses the staff building blocks (resident + membership + optional
 * invitation), so the desk sees the person the same second.
 */
class PortalHouseholdController extends Controller
{
    private const PORTAL_TYPES = [ResidentType::Owner, ResidentType::Tenant, ResidentType::Occupant];

    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
        private readonly CreateUnitMembership $createMembership,
        private readonly InviteResidentUser $invite,
        private readonly ResendUserInvitation $resend,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(['unit_id' => ['required', 'string', 'ulid']]);
        $unit = Unit::query()->findOrFail($validated['unit_id']);
        Gate::authorize('viewHousehold', [UnitMembership::class, $unit]);

        return response()->json([
            'data' => $this->members($unit, $request->user()),
            'can_manage' => $this->access->isPrimaryContactOf($request->user(), $unit),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'unit_id' => ['required', 'string', 'ulid'],
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['required', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'resident_type' => ['required', Rule::in(array_map(fn (ResidentType $type) => $type->value, self::PORTAL_TYPES))],
        ]);
        $unit = Unit::query()->with('location')->findOrFail($validated['unit_id']);
        Gate::authorize('manageHousehold', [UnitMembership::class, $unit]);

        $country = $unit->location->country ?? PhoneNumber::FALLBACK_COUNTRY;
        $request->validate(['phone' => PhoneNumber::rules($country)]);
        $phone = PhoneNumber::normalize($validated['phone'] ?? null, $country);
        $email = isset($validated['email']) && trim((string) $validated['email']) !== '' ? Str::lower(trim($validated['email'])) : null;

        /** @var User $actor */
        $actor = $request->user();

        $membership = DB::transaction(function () use ($unit, $validated, $phone, $email, $actor): UnitMembership {
            // A known email means a known person: attach, don't duplicate.
            $resident = $email !== null
                ? Resident::query()->where('account_id', $unit->account_id)->matchingEmail($email)->first()
                : null;

            if ($resident !== null && $resident->unitMemberships()->where('unit_id', $unit->id)->where('status', RegistryStatus::Active)->exists()) {
                throw ValidationException::withMessages(['email' => __('This person already lives in the unit.')]);
            }

            if ($resident === null) {
                $resident = Resident::query()->create([
                    'account_id' => $unit->account_id,
                    'first_name' => trim($validated['first_name']),
                    'last_name' => trim($validated['last_name']),
                    'phone' => $phone,
                    'email' => $email,
                    'status' => RegistryStatus::Active,
                ]);

                $this->activityLogger->log(
                    account: $unit->account,
                    eventType: ActivityEventType::ResidentCreated,
                    summary: "Residente {$resident->name} creado desde el portal por {$actor->name}.",
                    metadata: ['resident_id' => $resident->id, 'resident_name' => $resident->name, 'unit_id' => $unit->id, 'unit_label' => $unit->label(), 'source' => 'portal'],
                    location: $unit->location,
                    actor: $actor,
                    subjectType: 'resident',
                    subjectId: $resident->id,
                );
            }

            $membership = $this->createMembership->handle($resident, $unit, ['resident_type' => $validated['resident_type'], 'started_at' => now()->toDateString()], $actor);

            if ($email !== null && $resident->user_id === null && ! $resident->userInvitations()->where('status', UserInvitationStatus::Pending->value)->exists()) {
                $this->invite->handle($resident, $actor, ['email' => $email], $unit->location);
            }

            return $membership;
        });

        return response()->json(['data' => $this->member($membership->fresh(['resident.user', 'resident.userInvitations']), $actor)], 201);
    }

    public function destroy(Request $request, UnitMembership $membership): JsonResponse
    {
        $membership->loadMissing(['unit', 'resident']);
        Gate::authorize('manageHousehold', [UnitMembership::class, $membership->unit]);

        if ($membership->status !== RegistryStatus::Active) {
            throw ValidationException::withMessages(['membership' => __('This person no longer lives in the unit.')]);
        }
        if ($membership->is_primary_contact) {
            throw ValidationException::withMessages(['membership' => __('The primary contact cannot be removed from the portal.')]);
        }

        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($membership, $actor): void {
            $membership->forceFill([
                'status' => RegistryStatus::Inactive,
                'ended_at' => now()->toDateString(),
            ])->save();

            $this->createMembership->logMembershipActivity(
                membership: $membership,
                eventType: ActivityEventType::UnitMembershipInactivated,
                summary: "{$membership->resident->name} fue quitado de la unidad {$membership->unit->label()} desde el portal.",
                actor: $actor,
                changed: ['status', 'ended_at'],
                extraMetadata: ['source' => 'portal'],
            );
        });

        return response()->json(['data' => $this->member($membership->fresh(['resident.user', 'resident.userInvitations']), $actor)]);
    }

    public function resendInvitation(Request $request, UnitMembership $membership): JsonResponse
    {
        $membership->loadMissing(['unit', 'resident']);
        Gate::authorize('manageHousehold', [UnitMembership::class, $membership->unit]);

        $invitation = UserInvitation::query()
            ->where('resident_id', $membership->resident_id)
            ->where('status', UserInvitationStatus::Pending->value)
            ->latest()
            ->first();

        if ($invitation === null) {
            throw ValidationException::withMessages(['invitation' => __('This person has no pending invitation.')]);
        }

        $this->resend->handle($invitation, $request->user());

        return response()->json(['data' => $this->member($membership->fresh(['resident.user', 'resident.userInvitations']), $request->user())]);
    }

    /** @return list<array<string, mixed>> */
    private function members(Unit $unit, User $viewer): array
    {
        return $unit->unitMemberships()
            ->where('status', RegistryStatus::Active)
            ->with(['resident.user', 'resident.userInvitations'])
            ->get()
            ->sortBy([['is_primary_contact', 'desc'], fn ($a, $b) => strcmp($a->resident->last_name, $b->resident->last_name)])
            ->values()
            ->map(fn (UnitMembership $membership) => $this->member($membership, $viewer))
            ->all();
    }

    /** @return array<string, mixed> */
    private function member(UnitMembership $membership, User $viewer): array
    {
        $resident = $membership->resident;
        $pending = $resident->userInvitations->contains(fn (UserInvitation $invitation) => $invitation->status === UserInvitationStatus::Pending);

        return [
            'membership_id' => $membership->id,
            'resident_id' => $resident->id,
            'first_name' => $resident->first_name,
            'last_name' => $resident->last_name,
            'name' => $resident->name,
            'phone' => $resident->phone,
            'resident_type' => $membership->resident_type?->value,
            'is_primary_contact' => $membership->is_primary_contact,
            'is_me' => $resident->user_id !== null && $resident->user_id === $viewer->id,
            'portal_state' => $resident->user_id !== null ? 'active' : ($pending ? 'invited' : 'not_invited'),
            'status' => $membership->status->value,
            'started_at' => $membership->started_at?->toDateString(),
        ];
    }
}
