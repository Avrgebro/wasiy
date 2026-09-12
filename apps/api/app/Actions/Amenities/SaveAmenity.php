<?php

namespace App\Actions\Amenities;

use App\Enums\ActivityEventType;
use App\Enums\Weekday;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Create and update share one writer so normalization cannot drift: the
 * open days are stored in calendar order without duplicates and a
 * reservable Amenity must open at least one day (ADR 0043); a
 * non-reservable Amenity stores instant mode, null fees and no capacity — a
 * common space has no booking to configure, and stale values must not
 * resurface when it later becomes reservable. Its open days are kept: they
 * describe the space, not a policy.
 */
class SaveAmenity
{
    private const BOOKING_FIELDS = [
        'booking_mode',
        'daily_capacity',
        'fee_amount_minor',
        'deposit_amount_minor',
    ];

    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(Location $location, User $actor, array $attributes): Amenity
    {
        return DB::transaction(function () use ($location, $actor, $attributes): Amenity {
            $amenity = $location->amenities()->make([
                ...$this->normalize($attributes),
                'account_id' => $location->account_id,
                'slug' => $this->availableSlug($location, $attributes['name']),
            ]);
            $amenity->save();

            $this->log($amenity, $actor, ActivityEventType::AmenityCreated, "Se creó la amenidad {$amenity->name}.");

            return $amenity;
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Amenity $amenity, User $actor, array $attributes): Amenity
    {
        return DB::transaction(function () use ($amenity, $actor, $attributes): Amenity {
            $amenity->fill($this->normalize($attributes, $amenity));
            $changed = array_keys($amenity->getDirty());
            $amenity->save();

            if ($changed !== []) {
                $this->log(
                    $amenity,
                    $actor,
                    ActivityEventType::AmenityUpdated,
                    "Se actualizó la amenidad {$amenity->name}.",
                    ['changed_fields' => $changed],
                );
            }

            return $amenity;
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function normalize(array $attributes, ?Amenity $existing = null): array
    {
        if (array_key_exists('open_days', $attributes)) {
            $attributes['open_days'] = array_values(array_intersect(Weekday::keys(), $attributes['open_days'] ?? []));
        }

        $reservable = $attributes['is_reservable'] ?? $existing?->is_reservable ?? true;
        $openDays = $attributes['open_days'] ?? $existing?->openDays() ?? [];

        if ($reservable && $openDays === []) {
            throw ValidationException::withMessages([
                'open_days' => __('A reservable amenity opens at least one day of the week.'),
            ]);
        }

        if (! $reservable) {
            foreach (self::BOOKING_FIELDS as $field) {
                $attributes[$field] = $field === 'booking_mode' ? 'instant' : null;
            }
        }

        // The slug never changes on rename, matching Locations.
        unset($attributes['slug']);

        return $attributes;
    }

    private function availableSlug(Location $location, string $name): string
    {
        $base = Str::slug($name);
        $slug = $base;

        for ($suffix = 2; $this->slugTaken($location, $slug); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }

    private function slugTaken(Location $location, string $slug): bool
    {
        return Amenity::withTrashed()
            ->where('location_id', $location->id)
            ->where('slug', $slug)
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $extraMetadata
     */
    private function log(
        Amenity $amenity,
        User $actor,
        ActivityEventType $eventType,
        string $summary,
        array $extraMetadata = [],
    ): void {
        $this->activityLogger->log(
            account: $amenity->account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'amenity_id' => $amenity->id,
                'amenity_name' => $amenity->name,
                ...$extraMetadata,
            ],
            location: $amenity->location,
            actor: $actor,
            subjectType: 'amenity',
            subjectId: $amenity->id,
        );
    }
}
