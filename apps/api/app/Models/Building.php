<?php

namespace App\Models;

use Database\Factories\BuildingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A tower or block inside a Location (ADR 0037). Every Location has at least
 * one; a single-building Location keeps its one Building unnamed, which is
 * what hides the tower everywhere in the UI. Units point here, so renaming
 * a tower is one row and a typo can never fork it.
 */
#[Fillable(['account_id', 'location_id', 'name', 'sort_order'])]
class Building extends Model
{
    /** @use HasFactory<BuildingFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    /**
     * The Building a name refers to inside a Location, created when unknown.
     * A blank name means "the location's default": its unnamed Building, or
     * the first one when every Building is named, created when none exist.
     */
    public static function resolveForLocation(Location $location, ?string $name): self
    {
        $name = is_string($name) ? trim($name) : '';

        if ($name === '') {
            return self::query()->where('location_id', $location->id)->orderByRaw('name IS NOT NULL')->orderBy('sort_order')->first()
                ?? self::query()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'name' => null, 'sort_order' => 0]);
        }

        return self::query()->where('location_id', $location->id)->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
            ?? self::query()->create([
                'account_id' => $location->account_id,
                'location_id' => $location->id,
                'name' => $name,
                'sort_order' => ((int) self::query()->where('location_id', $location->id)->max('sort_order')) + 1,
            ]);
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return HasMany<Unit, $this>
     */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }
}
