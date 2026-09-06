<?php

namespace App\Http\Controllers\Api;

use App\Actions\Announcements\PublishAnnouncement;
use App\Enums\ActivityEventType;
use App\Enums\AnnouncementStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Staff side of Anuncios (mockups 18, 18b, 18c). Times arrive as wall-clock
 * strings in the location's timezone; expiry is a calendar day there.
 */
class AnnouncementController extends Controller
{
    public function __construct(private readonly ActivityLogger $activityLogger) {}

    public function index(Request $request, Location $location): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', [Announcement::class, $location]);

        $validated = $request->validate([
            ...$this->paginationRules(),
            'status' => ['sometimes', 'nullable', Rule::enum(AnnouncementStatus::class)],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
        $today = CarbonImmutable::now($location->timezone)->toDateString();

        $announcements = Announcement::query()
            ->where('location_id', $location->id)
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->withStatus(AnnouncementStatus::from($status), $today))
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->searchLike(['title'], $search))
            ->with(['author', 'location'])
            ->orderByRaw('COALESCE(published_at, publish_at) DESC')
            ->orderByDesc('id');

        return AnnouncementResource::collection($announcements->paginate($this->perPage($validated))->withQueryString());
    }

    public function store(Request $request, Location $location, PublishAnnouncement $publish): JsonResponse
    {
        Gate::authorize('create', [Announcement::class, $location]);

        $validated = $request->validate($this->rules());
        /** @var User $actor */
        $actor = $request->user();
        $publishAt = $this->publishAt($validated, $location);
        $this->guardExpiry($validated['expires_on'] ?? null, $publishAt, $location);

        $announcement = new Announcement([
            'account_id' => $location->account_id,
            'location_id' => $location->id,
            'author_user_id' => $actor->id,
            'title' => $validated['title'],
            'body_md' => $validated['body_md'],
            'excerpt' => Announcement::excerptOf($validated['body_md']),
            'is_important' => (bool) ($validated['is_important'] ?? false),
            'publish_at' => $publishAt,
            'expires_on' => $validated['expires_on'] ?? null,
        ]);
        $announcement->save();

        if ($publishAt->lessThanOrEqualTo(now())) {
            $publish->handle($announcement, $actor);
        } else {
            $this->activityLogger->log(
                account: $location->account,
                eventType: ActivityEventType::AnnouncementScheduled,
                summary: "Anuncio programado: «{$announcement->title}» para el ".$publishAt->setTimezone($location->timezone)->locale('es')->isoFormat('D [de] MMMM, HH:mm').'.',
                metadata: ['announcement_id' => $announcement->id, 'title' => $announcement->title, 'publish_at' => $publishAt->toJSON()],
                location: $location,
                actor: $actor,
                subjectType: 'announcement',
                subjectId: $announcement->id,
            );
        }

        return (new AnnouncementResource($announcement->fresh(['author', 'location'])))->response()->setStatusCode(201);
    }

    public function show(Announcement $announcement): JsonResource
    {
        Gate::authorize('view', $announcement);

        return new AnnouncementResource($announcement->load(['author', 'location']));
    }

    /** Edits never re-notify. A scheduled post may move its publish time; a live one may not. */
    public function update(Request $request, Announcement $announcement, PublishAnnouncement $publish): JsonResource
    {
        Gate::authorize('update', $announcement);
        $announcement->loadMissing('location');
        $location = $announcement->location;

        if ($announcement->archived_at !== null) {
            throw ValidationException::withMessages(['status' => __('An archived announcement cannot be edited.')]);
        }

        $validated = $request->validate($this->rules(update: true));
        /** @var User $actor */
        $actor = $request->user();

        $publishAt = $announcement->publish_at;
        if ($announcement->published_at === null && array_key_exists('publish_at', $validated)) {
            $publishAt = $this->publishAt($validated, $location);
        } elseif ($announcement->published_at !== null && array_key_exists('publish_at', $validated) && ! empty($validated['publish_at'])) {
            throw ValidationException::withMessages(['publish_at' => __('A published announcement keeps its publication time.')]);
        }
        $expiresOn = array_key_exists('expires_on', $validated) ? $validated['expires_on'] : $announcement->expires_on?->toDateString();
        $this->guardExpiry($expiresOn, $publishAt, $location);

        $announcement->fill([
            ...collect($validated)->only(['title', 'is_important'])->all(),
            ...(array_key_exists('body_md', $validated) ? ['body_md' => $validated['body_md'], 'excerpt' => Announcement::excerptOf($validated['body_md'])] : []),
            'publish_at' => $publishAt,
            'expires_on' => $expiresOn,
        ])->save();

        if ($announcement->published_at === null && $publishAt->lessThanOrEqualTo(now())) {
            $publish->handle($announcement, $actor);
        } else {
            $this->activityLogger->log(
                account: $location->account,
                eventType: ActivityEventType::AnnouncementUpdated,
                summary: "Anuncio editado: «{$announcement->title}».",
                metadata: ['announcement_id' => $announcement->id, 'title' => $announcement->title, 'changed' => array_keys($validated)],
                location: $location,
                actor: $actor,
                subjectType: 'announcement',
                subjectId: $announcement->id,
            );
        }

        return new AnnouncementResource($announcement->fresh(['author', 'location']));
    }

    /** Pulls the post from the portal; alerts already sent stay in the residents' history. */
    public function archive(Request $request, Announcement $announcement): JsonResource
    {
        Gate::authorize('archive', $announcement);
        $announcement->loadMissing('location');

        if ($announcement->archived_at === null) {
            $announcement->forceFill(['archived_at' => now()])->save();

            /** @var User $actor */
            $actor = $request->user();
            $this->activityLogger->log(
                account: $announcement->location->account,
                eventType: ActivityEventType::AnnouncementArchived,
                summary: "Anuncio archivado: «{$announcement->title}».",
                metadata: ['announcement_id' => $announcement->id, 'title' => $announcement->title],
                location: $announcement->location,
                actor: $actor,
                subjectType: 'announcement',
                subjectId: $announcement->id,
            );
        }

        return new AnnouncementResource($announcement->fresh(['author', 'location']));
    }

    /** @return array<string, array<int, mixed>> */
    private function rules(bool $update = false): array
    {
        $presence = $update ? 'sometimes' : 'required';

        return [
            'title' => [$presence, 'string', 'max:160'],
            'body_md' => [$presence, 'string', 'max:5000'],
            'is_important' => ['sometimes', 'boolean'],
            // Wall-clock in the location's timezone; empty means now.
            'publish_at' => ['sometimes', 'nullable', 'date_format:Y-m-d H:i'],
            'expires_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ];
    }

    /** @param  array<string, mixed>  $validated */
    private function publishAt(array $validated, Location $location): CarbonImmutable
    {
        $raw = $validated['publish_at'] ?? null;

        return $raw
            ? CarbonImmutable::createFromFormat('Y-m-d H:i', $raw, $location->timezone)->utc()
            : CarbonImmutable::now();
    }

    private function guardExpiry(?string $expiresOn, CarbonImmutable $publishAt, Location $location): void
    {
        if ($expiresOn !== null && $expiresOn < $publishAt->setTimezone($location->timezone)->toDateString()) {
            throw ValidationException::withMessages(['expires_on' => __('The expiry day cannot precede the publication day.')]);
        }
    }
}
