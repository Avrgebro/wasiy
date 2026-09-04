<?php

namespace App\Models;

use App\Enums\RegistryStatus;
use App\Enums\UnitType;
use Database\Factories\UnitFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

#[Fillable([
    'account_id',
    'location_id',
    'unit_number',
    'type',
    'building_name',
    'floor',
    'area_m2',
    'participation_share',
    'maintenance_fee',
    'parking_spots',
    'storage_rooms',
    'status',
    'notes',
])]
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
            'type' => UnitType::class,
            'area_m2' => 'decimal:2',
            'participation_share' => 'decimal:3',
            'maintenance_fee' => 'integer',
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
     * Canonical display label: "building / number", omitting blank parts.
     */
    public function label(): string
    {
        return collect([$this->building_name, $this->unit_number])
            ->filter(fn (?string $part): bool => is_string($part) && trim($part) !== '')
            ->implode(' / ');
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
     * Active residents who already have a portal user.
     *
     * @return HasMany<UnitMembership, $this>
     */
    public function portalMemberships(): HasMany
    {
        return $this->unitMemberships()->active()
            ->whereHas('resident', fn (Builder $query) => $query->whereNotNull('user_id'));
    }

    /**
     * Active residents with a pending portal invitation and no user yet.
     *
     * @return HasMany<UnitMembership, $this>
     */
    public function invitedMemberships(): HasMany
    {
        return $this->unitMemberships()->active()
            ->whereHas('resident', fn (Builder $query) => $query
                ->whereNull('user_id')
                ->whereHas('userInvitations', fn (Builder $invitation) => $invitation->where('status', 'pending')));
    }

    /**
     * Comma-separated labels ("E-12, E-13") as a clean list.
     *
     * @return list<string>
     */
    public static function labels(?string $raw): array
    {
        return collect(explode(',', (string) $raw))
            ->map(fn (string $label): string => trim($label))
            ->filter()
            ->values()
            ->all();
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
            'portalMemberships',
            'invitedMemberships',
        ];
    }

    public function loadSummary(): self
    {
        return $this->load(self::summaryRelations())
            ->loadCount(self::summaryCounts());
    }
}
