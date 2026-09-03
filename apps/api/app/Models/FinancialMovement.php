<?php

namespace App\Models;

use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'account_id',
    'location_id',
    'direction',
    'category',
    'amount',
    'concept',
    'detail',
    'counterparty',
    'unit_id',
    'reservation_id',
    'occurred_on',
    'due_on',
    'note',
])]
class FinancialMovement extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * Status and audit columns move only through the actions.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'direction' => MovementDirection::class,
            'category' => MovementCategory::class,
            'status' => MovementStatus::class,
            'amount' => 'integer',
            'occurred_on' => 'immutable_date',
            'due_on' => 'immutable_date',
            'settled_at' => 'datetime',
        ];
    }

    /**
     * @return list<MovementStatus>
     */
    public function allowedTransitions(): array
    {
        return $this->status->transitionsFor($this->category);
    }

    /**
     * @param  Builder<FinancialMovement>  $query
     */
    public function scopeInMonth(Builder $query, string $month): void
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d', "{$month}-01")->startOfMonth();

        $query->whereBetween('occurred_on', [$start->toDateString(), $start->endOfMonth()->toDateString()]);
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
     * @return BelongsTo<Reservation, $this>
     */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function settledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'settled_by');
    }
}
