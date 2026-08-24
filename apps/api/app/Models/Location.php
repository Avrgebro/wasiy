<?php

namespace App\Models;

use App\Enums\LocationType;
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
    'name',
    'slug',
    'type',
    'timezone',
    'address_line1',
    'address_line2',
    'district',
    'city',
    'state',
    'postal_code',
    'country',
    'phone',
    'contact_email',
    'access_notes',
])]
class Location extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * `settings` holds only the keys this Location overrides — read via
     * SettingsResolver, written only through the settings update action.
     * `deactivated_at` is set through deactivate()/reactivate(), never mass
     * assignment: deactivation means a property was operational and has been
     * retired, while soft delete stays reserved for genuine mistakes.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => LocationType::class,
            'settings' => 'array',
            'deactivated_at' => 'datetime',
        ];
    }

    public function isDeactivated(): bool
    {
        return $this->deactivated_at !== null;
    }

    public function deactivate(User $deactivatedBy): bool
    {
        return $this->forceFill([
            'deactivated_at' => $this->freshTimestamp(),
            'deactivated_by_user_id' => $deactivatedBy->id,
        ])->save();
    }

    public function reactivate(): bool
    {
        return $this->forceFill([
            'deactivated_at' => null,
            'deactivated_by_user_id' => null,
        ])->save();
    }

    /**
     * @param  Builder<Location>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('deactivated_at');
    }

    /**
     * @param  Builder<Location>  $query
     */
    public function scopeDeactivated(Builder $query): void
    {
        $query->whereNotNull('deactivated_at');
    }

    /**
     * The one-line address for tiles, table cells, and exports: present
     * components joined, absent ones skipped without stray separators.
     */
    public function formattedAddress(): ?string
    {
        $formatted = implode(', ', array_filter([
            $this->address_line1,
            $this->district,
            $this->city,
        ], fn (?string $component): bool => $component !== null && $component !== ''));

        return $formatted === '' ? null : $formatted;
    }

    /**
     * @return BelongsTo<Account, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function deactivatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deactivated_by_user_id');
    }

    /**
     * @return HasMany<Amenity, $this>
     */
    public function amenities(): HasMany
    {
        return $this->hasMany(Amenity::class);
    }

    /**
     * @return MorphMany<Photo, $this>
     */
    public function photos(): MorphMany
    {
        return $this->morphMany(Photo::class, 'photoable')->orderBy('sort_order');
    }

    /**
     * @return HasMany<StaffLocationRole, $this>
     */
    public function staffLocationRoles(): HasMany
    {
        return $this->hasMany(StaffLocationRole::class);
    }

    /**
     * @return HasMany<Unit, $this>
     */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    /**
     * @return HasMany<UnitMembership, $this>
     */
    public function unitMemberships(): HasMany
    {
        return $this->hasMany(UnitMembership::class);
    }

    /**
     * @return HasMany<Vehicle, $this>
     */
    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }
}
