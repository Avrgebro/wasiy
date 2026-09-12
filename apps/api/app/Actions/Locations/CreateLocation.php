<?php

namespace App\Actions\Locations;

use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Support\Timezones;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Locations are created active: deactivation means a property was
 * operational and has been retired, never a staging state. A new Location
 * has no Units, Residents, or portal users, so there is nobody to hide it
 * from, and creating it inactive would keep it out of accessible_locations
 * — unusable as the Active Location its own data entry needs.
 */
class CreateLocation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function handle(Account $account, User $actor, array $attributes): Location
    {
        return DB::transaction(function () use ($account, $actor, $attributes): Location {
            $location = $account->locations()->create([
                ...$attributes,
                // Derived from the country unless a client sent one (ADR 0037 era API contract).
                'timezone' => $attributes['timezone'] ?? Timezones::forCountry($attributes['country'] ?? null),
                'slug' => $this->availableSlug($account, $attributes['name']),
            ]);

            // The single, unnamed Building every Location starts with (ADR 0037).
            $location->buildings()->create(['account_id' => $account->id, 'name' => null, 'sort_order' => 0]);

            $this->activityLogger->log(
                account: $account,
                eventType: ActivityEventType::LocationCreated,
                summary: "Se creó la ubicación {$location->name}.",
                metadata: [
                    'location_id' => $location->id,
                    'location_name' => $location->name,
                ],
                location: $location,
                actor: $actor,
                subjectType: 'location',
                subjectId: $location->id,
            );

            return $location;
        });
    }

    /**
     * The slug derives from the name once, at creation, and never changes on
     * rename: slugs are stable identifiers and a rename should not break
     * bookmarks. Duplicate names are rejected by validation, but a
     * soft-deleted Location can still hold the slug, so suffix until free.
     */
    private function availableSlug(Account $account, string $name): string
    {
        $base = Str::slug($name);
        $slug = $base;

        for ($suffix = 2; $this->slugTaken($account, $slug); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }

    private function slugTaken(Account $account, string $slug): bool
    {
        return Location::withTrashed()
            ->where('account_id', $account->id)
            ->where('slug', $slug)
            ->exists();
    }
}
