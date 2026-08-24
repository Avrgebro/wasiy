<?php

namespace App\Actions\Amenities;

use App\Data\AmenityAvailability;
use App\Enums\ActivityEventType;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Create and update share one writer so normalization cannot drift: the
 * availability json is validated through AmenityAvailability, and a
 * non-reservable Amenity stores null booking policy and fees — a common
 * space has no booking to configure, and stale values must not resurface
 * when it later becomes reservable.
 */
class SaveAmenity
{
    private const BOOKING_FIELDS = [
        'booking_mode',
        'max_duration_minutes',
        'min_duration_minutes',
        'buffer_minutes',
        'max_advance_days',
        'max_concurrent_per_unit',
        'cancellation_window_hours',
        'fee_amount',
        'deposit_amount',
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
        if (array_key_exists('availability', $attributes)) {
            try {
                $attributes['availability'] = $attributes['availability'] === null
                    ? null
                    : AmenityAvailability::fromArray($attributes['availability'])->toArray();
            } catch (InvalidArgumentException $exception) {
                // Window semantics (overlap, order) are the value object's
                // rules; surface them as field errors, not server faults.
                throw ValidationException::withMessages([
                    'availability' => $exception->getMessage(),
                ]);
            }
        }

        $reservable = $attributes['is_reservable'] ?? $existing?->is_reservable ?? true;

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
