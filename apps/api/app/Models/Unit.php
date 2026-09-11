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

#[Fillable([
    'account_id',
    'location_id',
    'unit_number',
    'type',
    'building_id',
    // Accepted for mass assignment and resolved to a Building on save.
    'building_name',
    'floor',
    'participation_share',
    'maintenance_fee_minor',
    'parking_spots',
    'storage_rooms',
    'status',
    'notes',
])]
class Unit extends Model
{
    /** @use HasFactory<UnitFactory> */
    use HasFactory, HasUlids;

    /** Labels, search and resources read the tower through this relation. */
    protected $with = ['building'];

    /** A building name assigned before save; resolved once location_id is known. */
    private ?string $pendingBuildingName = null;

    private bool $hasPendingBuildingName = false;

    /**
     * Resolve the tower before every write. Done here rather than in a
     * `saving` listener because seeders run WithoutModelEvents.
     *
     * @param  array<string, mixed>  $options
     */
    public function save(array $options = []): bool
    {
        // A blank name never overrides an explicit building_id (factories
        // pass both); a real name always wins.
        $pending = is_string($this->pendingBuildingName) ? trim($this->pendingBuildingName) : '';
        if ($this->hasPendingBuildingName && ($pending !== '' || $this->building_id === null)) {
            $this->building_id = Building::resolveForLocation($this->location, $pending)->id;
        }
        $this->hasPendingBuildingName = false;
        $this->pendingBuildingName = null;

        if ($this->building_id === null) {
            $this->building_id = Building::resolveForLocation($this->location, null)->id;
        }

        if ($this->isDirty('building_id')) {
            $this->unsetRelation('building');
        }

        return parent::save($options);
    }

    /**
     * Setting the tower by name keeps factories, seeders and the CSV import
     * simple: the Building is looked up or created in the unit's Location.
     */
    public function setBuildingNameAttribute(?string $name): void
    {
        $this->pendingBuildingName = $name;
        $this->hasPendingBuildingName = true;
    }

    public function getBuildingNameAttribute(): ?string
    {
        if ($this->hasPendingBuildingName) {
            return $this->pendingBuildingName;
        }

        return $this->building?->name;
    }

    /**
     * Case-insensitive match on unit number and tower name (the desk types
     * both; the spotlight sends one term for everything).
     *
     * @param  Builder<Unit>  $query
     */
    public function scopeSearchIdentity(Builder $query, string $search): void
    {
        $query->where(fn (Builder $group) => $group
            ->searchLike(['unit_number'], $search)
            ->orWhereHas('building', fn (Builder $building) => $building->searchLike(['name', 'code'], $search)));
    }

    /**
     * Towers in the order the Location lists them, then whatever follows.
     *
     * @param  Builder<Unit>  $query
     */
    public function scopeOrderByBuilding(Builder $query, string $direction = 'asc'): void
    {
        $query->orderBy(Building::query()->select('sort_order')->whereColumn('buildings.id', 'units.building_id'), $direction);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => RegistryStatus::class,
            'type' => UnitType::class,
            'participation_share' => 'decimal:3',
            'maintenance_fee_minor' => 'integer',
        ];
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
     * @return BelongsTo<Building, $this>
     */
    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
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
     * The earliest active membership; the list names this person when no one
     * is marked primary contact.
     *
     * @return HasOne<UnitMembership, $this>
     */
    public function firstActiveMembership(): HasOne
    {
        return $this->hasOne(UnitMembership::class)
            ->active()
            ->ofMany('id', 'min');
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
            'firstActiveMembership.resident',
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
