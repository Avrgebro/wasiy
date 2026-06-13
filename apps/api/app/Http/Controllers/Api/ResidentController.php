<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ResidentResource;
use App\Models\Account;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ResidentController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function index(Request $request, Account $account): AnonymousResourceCollection
    {
        abort_unless($this->access->canAccessAccount($request->user(), $account), 403);

        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::enum(RegistryStatus::class)],
            'location_id' => ['sometimes', 'nullable', 'string', 'ulid', Rule::exists('locations', 'id')->where('account_id', $account->id)->whereNull('deleted_at')],
            'unit_id' => ['sometimes', 'nullable', 'string', 'ulid', Rule::exists('units', 'id')->where('account_id', $account->id)],
        ]);

        $residents = Resident::query()
            ->where('account_id', $account->id)
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['search'] ?? null, function (Builder $query, string $search): void {
                $likeSearch = '%'.addcslashes(Str::lower(trim($search)), '\\%_').'%';

                $query->where(function (Builder $query) use ($likeSearch): void {
                    $query
                        ->whereRaw('LOWER(first_name) LIKE ?', [$likeSearch])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$likeSearch])
                        ->orWhereRaw("LOWER(first_name || ' ' || last_name) LIKE ?", [$likeSearch])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$likeSearch])
                        ->orWhereRaw('LOWER(phone) LIKE ?', [$likeSearch]);
                });
            });

        $accessibleLocationIds = $this->access->accessibleLocationsForAccount($request->user(), $account)->pluck('id');

        if (! $this->access->hasAccountRole($request->user(), $account, AccountRole::AccountAdmin)) {
            $residents->whereHas('unitMemberships', fn (Builder $query) => $query->whereIn('location_id', $accessibleLocationIds));
        }

        if ($validated['location_id'] ?? null) {
            $residents->whereHas('unitMemberships', fn (Builder $query) => $query->where('location_id', $validated['location_id']));
        }

        if ($validated['unit_id'] ?? null) {
            $residents->whereHas('unitMemberships', fn (Builder $query) => $query->where('unit_id', $validated['unit_id']));
        }

        return ResidentResource::collection(
            $residents
                ->with(Resident::summaryRelations())
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->paginate((int) ($validated['per_page'] ?? 15))
                ->withQueryString()
        );
    }

    public function store(Request $request, Account $account): JsonResponse
    {
        $validated = $this->validateResidentPayload($request, $account);

        /** @var User $user */
        $user = $request->user();

        $resident = DB::transaction(function () use ($account, $validated, $user): Resident {
            $resident = Resident::query()->create([
                ...collect($validated)->only(['first_name', 'last_name', 'phone', 'email'])->all(),
                'account_id' => $account->id,
                'status' => RegistryStatus::Active,
            ]);

            $this->logResidentActivity(
                resident: $resident,
                eventType: ActivityEventType::ResidentCreated,
                summary: "Residente {$resident->name} creado.",
                actor: $user,
            );

            foreach ($validated['memberships'] ?? [] as $membership) {
                $unit = Unit::query()->where('account_id', $account->id)->findOrFail($membership['unit_id']);
                Gate::forUser($user)->authorize('create', [UnitMembership::class, $unit->location]);
                $this->createMembership($resident, $unit, $membership, $user);
            }

            return $resident;
        });

        return (new ResidentResource($resident->loadSummary()))->response()->setStatusCode(201);
    }

    public function show(Request $request, Resident $resident): ResidentResource
    {
        $this->authorizeResidentAccess($request, $resident);

        return new ResidentResource($resident->loadSummary());
    }

    public function update(Request $request, Resident $resident): ResidentResource
    {
        $this->authorizeResidentAccess($request, $resident, mutate: true);

        $validated = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:255'],
            'last_name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'status' => ['sometimes', 'required', Rule::enum(RegistryStatus::class)],
        ]);

        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($resident, $validated, $actor): void {
            $resident->fill($validated);

            if (! $resident->isDirty()) {
                return;
            }

            $changed = array_keys($resident->getDirty());
            $wasStatus = $resident->getOriginal('status');

            $resident->save();

            $eventType = $wasStatus !== RegistryStatus::Inactive->value && $resident->status === RegistryStatus::Inactive
                ? ActivityEventType::ResidentInactivated
                : ActivityEventType::ResidentUpdated;

            $this->logResidentActivity(
                resident: $resident,
                eventType: $eventType,
                summary: $eventType === ActivityEventType::ResidentInactivated
                    ? "Residente {$resident->name} inactivado."
                    : "Residente {$resident->name} actualizado.",
                actor: $actor,
                changed: $changed,
            );
        });

        return new ResidentResource($resident->loadSummary());
    }

    public function destroy(Request $request, Resident $resident): ResidentResource|Response
    {
        $this->authorizeResidentAccess($request, $resident, mutate: true);

        if (! $resident->unitMemberships()->exists() && $resident->user_id === null) {
            $resident->delete();

            return response()->noContent();
        }

        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($resident, $actor): void {
            $resident->forceFill(['status' => RegistryStatus::Inactive])->save();

            $this->logResidentActivity(
                resident: $resident,
                eventType: ActivityEventType::ResidentInactivated,
                summary: "Residente {$resident->name} inactivado.",
                actor: $actor,
                changed: ['status'],
            );
        });

        return new ResidentResource($resident->loadSummary());
    }

    /**
     * @return array<string, mixed>
     */
    private function validateResidentPayload(Request $request, Account $account): array
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'memberships' => ['sometimes', 'array'],
            'memberships.*.unit_id' => ['required', 'string', 'ulid', Rule::exists('units', 'id')->where('account_id', $account->id)],
            'memberships.*.resident_type' => ['required', Rule::enum(ResidentType::class)],
            'memberships.*.status' => ['sometimes', Rule::enum(RegistryStatus::class)],
            'memberships.*.is_primary_contact' => ['sometimes', 'boolean'],
            'memberships.*.started_at' => ['sometimes', 'nullable', 'date'],
            'memberships.*.ended_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:memberships.*.started_at'],
        ]);

        $this->validateMembershipUnitsAreManageable($request, $validated['memberships'] ?? [], 'memberships');

        return $validated;
    }

    /**
     * @param  array<int, array<string, mixed>>  $memberships
     */
    private function validateMembershipUnitsAreManageable(Request $request, array $memberships, string $field): void
    {
        $messages = [];

        foreach ($memberships as $index => $membership) {
            $unit = Unit::query()->find($membership['unit_id'] ?? null);

            if (! $unit || ! Gate::forUser($request->user())->allows('create', [UnitMembership::class, $unit->location])) {
                $messages["{$field}.{$index}.unit_id"] = __('The selected unit is not available for membership assignment.');
            }
        }

        if ($messages !== []) {
            throw ValidationException::withMessages($messages);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function createMembership(Resident $resident, Unit $unit, array $payload, User $actor): UnitMembership
    {
        $membership = $resident->unitMemberships()->create([
            'account_id' => $resident->account_id,
            'location_id' => $unit->location_id,
            'unit_id' => $unit->id,
            'resident_type' => $payload['resident_type'],
            'status' => $payload['status'] ?? RegistryStatus::Active,
            'is_primary_contact' => false,
            'started_at' => $payload['started_at'] ?? null,
            'ended_at' => $payload['ended_at'] ?? null,
        ]);

        if (($payload['is_primary_contact'] ?? false) === true) {
            $membership->markAsPrimaryContact();
            $membership->refresh();
        }

        $this->logMembershipActivity(
            membership: $membership,
            eventType: ActivityEventType::UnitMembershipCreated,
            summary: "{$resident->name} fue asignado a la unidad {$this->unitLabel($unit)}.",
            actor: $actor,
        );

        if (($payload['is_primary_contact'] ?? false) === true) {
            $this->logMembershipActivity(
                membership: $membership,
                eventType: ActivityEventType::UnitMembershipPrimaryContactChanged,
                summary: "{$resident->name} quedo como contacto principal de la unidad {$this->unitLabel($unit)}.",
                actor: $actor,
                extraMetadata: [
                    'new_primary_membership_id' => $membership->id,
                ],
            );
        }

        return $membership;
    }

    private function authorizeResidentAccess(Request $request, Resident $resident, bool $mutate = false): void
    {
        /** @var User $user */
        $user = $request->user();

        if ($this->access->hasAccountRole($user, $resident->account, AccountRole::AccountAdmin)) {
            return;
        }

        $location = $resident->unitMemberships()
            ->whereIn('location_id', $this->access->accessibleLocationsForAccount($user, $resident->account)->pluck('id'))
            ->first()
            ?->location;

        abort_unless($location && Gate::forUser($user)->allows($mutate ? 'updateInLocation' : 'viewInLocation', [$resident, $location]), 403);
    }

    /**
     * @param  array<int, string>  $changed
     */
    private function logResidentActivity(Resident $resident, ActivityEventType $eventType, string $summary, User $actor, array $changed = []): void
    {
        $this->activityLogger->log(
            account: $resident->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'resident_id' => $resident->id,
                'resident_name' => $resident->name,
                'resident_email' => $resident->email,
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'changed' => $changed,
            ],
            actor: $actor,
            subjectType: Resident::class,
            subjectId: $resident->id,
        );
    }

    /**
     * @param  array<string, mixed>  $extraMetadata
     */
    private function logMembershipActivity(UnitMembership $membership, ActivityEventType $eventType, string $summary, User $actor, array $extraMetadata = []): void
    {
        $membership->loadMissing(['account', 'location', 'resident', 'unit']);

        $this->activityLogger->log(
            account: $membership->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'membership_id' => $membership->id,
                'resident_id' => $membership->resident_id,
                'resident_name' => $membership->resident->name,
                'unit_id' => $membership->unit_id,
                'unit_label' => $this->unitLabel($membership->unit),
                'location_id' => $membership->location_id,
                'location_name' => $membership->location->name,
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                ...$extraMetadata,
            ],
            location: $membership->location,
            actor: $actor,
            subjectType: UnitMembership::class,
            subjectId: $membership->id,
        );
    }

    private function unitLabel(Unit $unit): string
    {
        return trim(collect([$unit->building_name, $unit->unit_number])->filter()->implode(' / '));
    }
}
