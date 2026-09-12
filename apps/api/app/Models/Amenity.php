<?php

namespace App\Models;

use App\Enums\BookingMode;
use App\Enums\ReservationStatus;
use App\Enums\Weekday;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
    'open_days',
    'daily_capacity',
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
            'open_days' => 'array',
            'daily_capacity' => 'integer',
            'deactivated_at' => 'datetime',
        ];
    }

    /**
     * The weekdays this amenity takes bookings on (ADR 0043).
     *
     * @return list<string>
     */
    public function openDays(): array
    {
        return array_values($this->open_days ?? []);
    }

    public function isOpenOn(CarbonInterface $day): bool
    {
        return in_array(Weekday::of($day)->value, $this->openDays(), true);
    }

    /**
     * Approved bookings on one local day: the number capacity is measured
     * against. Only approved rows count (ADR 0043).
     */
    public function approvedCountOn(string $date): int
    {
        return $this->reservations()
            ->where('status', ReservationStatus::Approved->value)
            ->whereDate('reserved_on', $date)
            ->count();
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
     * @return HasMany<Reservation, $this>
     */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    /**
     * @return MorphMany<Photo, $this>
     */
    public function photos(): MorphMany
    {
        return $this->morphMany(Photo::class, 'photoable')->orderBy('sort_order');
    }
}
