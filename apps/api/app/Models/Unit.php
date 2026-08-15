<?php

namespace App\Models;

use App\Enums\RegistryStatus;
use Database\Factories\UnitFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['account_id', 'location_id', 'unit_number', 'building_name', 'floor', 'status', 'notes'])]
class Unit extends Model
{
    /** @use HasFactory<UnitFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => RegistryStatus::class,
        ];
    }

    /**
     * Case-insensitive unit identity used by registry imports. Must stay in
     * lockstep with importMatchKey() and
     * NormalizedRegistryRow::unitMatchKey().
     *
     * @param  Builder<Unit>  $query
     */
    public function scopeMatchingImportIdentity(Builder $query, ?string $unitNumber, ?string $buildingName): void
    {
        $query
            ->whereRaw('LOWER(unit_number) = ?', [Str::lower((string) $unitNumber)])
            ->whereRaw("LOWER(COALESCE(building_name, '')) = ?", [Str::lower((string) $buildingName)]);
    }

    /**
     * The in-memory counterpart of scopeMatchingImportIdentity.
     */
    public function importMatchKey(): string
    {
        return Str::lower((string) $this->unit_number).'|'.Str::lower((string) ($this->building_name ?? ''));
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
     * @return HasMany<UnitMembership, $this>
     */
    public function unitMemberships(): HasMany
    {
        return $this->hasMany(UnitMembership::class);
    }

    /**
     * @return HasMany<UnitMembership, $this>
     */
    public function activeUnitMemberships(): HasMany
    {
        return $this->unitMemberships()->active();
    }

    /**
     * @return HasOne<UnitMembership, $this>
     */
    public function primaryContactMembership(): HasOne
    {
        return $this->hasOne(UnitMembership::class)
            ->active()
            ->where('is_primary_contact', true);
    }

    /**
     * @return HasMany<Vehicle, $this>
     */
    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    /**
     * @return array<string, callable>
     */
    public static function summaryRelations(): array
    {
        return [
            'primaryContactMembership.resident',
        ];
    }

    /**
     * @return array<string, callable>
     */
    public static function summaryCounts(): array
    {
        return [
            'activeUnitMemberships',
            'vehicles',
        ];
    }

    public function loadSummary(): self
    {
        return $this->load(self::summaryRelations())
            ->loadCount(self::summaryCounts());
    }
}
