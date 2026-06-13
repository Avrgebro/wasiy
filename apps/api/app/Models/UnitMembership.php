<?php

namespace App\Models;

use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use Database\Factories\UnitMembershipFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

#[Fillable([
    'account_id',
    'location_id',
    'unit_id',
    'resident_id',
    'resident_type',
    'status',
    'is_primary_contact',
    'started_at',
    'ended_at',
])]
class UnitMembership extends Model
{
    /** @use HasFactory<UnitMembershipFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'resident_type' => ResidentType::class,
            'status' => RegistryStatus::class,
            'is_primary_contact' => 'boolean',
            'started_at' => 'date',
            'ended_at' => 'date',
        ];
    }

    public function markAsPrimaryContact(): void
    {
        DB::transaction(function () {
            static::query()
                ->where('unit_id', $this->unit_id)
                ->where('status', RegistryStatus::Active)
                ->where('is_primary_contact', true)
                ->whereKeyNot($this->getKey())
                ->update(['is_primary_contact' => false]);

            $this->forceFill([
                'status' => RegistryStatus::Active,
                'is_primary_contact' => true,
            ])->save();
        });
    }

    /**
     * @param  Builder<UnitMembership>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('status', RegistryStatus::Active);
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
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * @return BelongsTo<Resident, $this>
     */
    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function loadSummary(): self
    {
        return $this->load(['unit', 'resident']);
    }
}
