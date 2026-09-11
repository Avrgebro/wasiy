<?php

namespace App\Models;

use App\Data\AmenityAvailability;
use App\Enums\BookingMode;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'account_id',
    'location_id',
    'name',
    'slug',
    'description',
    'is_reservable',
    'booking_mode',
    'availability',
    'slot_minutes',
    'fee_amount_minor',
    'deposit_amount_minor',
])]
class Amenity extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * `deactivated_at` follows the Location pattern: set through
     * deactivate()/reactivate(), never mass assignment. A deactivated
     * ("paused" in the UI) Amenity stays listed with history but leaves the
     * resident portal and accepts no new reservations.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'booking_mode' => BookingMode::class,
            'is_reservable' => 'boolean',
            'availability' => 'array',
            'deactivated_at' => 'datetime',
        ];
    }

    /**
     * @return Attribute<AmenityAvailability, never>
     */
    protected function availabilitySchedule(): Attribute
    {
        return Attribute::make(
            get: fn (): AmenityAvailability => $this->availability === null
                ? AmenityAvailability::alwaysClosed()
                : AmenityAvailability::fromArray($this->availability),
        );
    }

    /** Slot length in minutes (ADR 0041); the column default is 60. */
    public function slotMinutes(): int
    {
        return (int) ($this->slot_minutes ?? 60);
    }

    public function isDeactivated(): bool
    {
        return $this->deactivated_at !== null;
    }

    public function deactivate(): bool
    {
        return $this->forceFill(['deactivated_at' => $this->freshTimestamp()])->save();
    }

    public function reactivate(): bool
    {
        return $this->forceFill(['deactivated_at' => null])->save();
    }

    /**
     * @param  Builder<Amenity>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('deactivated_at');
    }

    /**
     * @return BelongsTo<Account, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return MorphMany<Photo, $this>
     */
    public function photos(): MorphMany
    {
        return $this->morphMany(Photo::class, 'photoable')->orderBy('sort_order');
    }
}
