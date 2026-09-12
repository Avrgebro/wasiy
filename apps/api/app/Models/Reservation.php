<?php

namespace App\Models;

use App\Enums\ReservationStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'account_id',
    'location_id',
    'amenity_id',
    'unit_id',
    'resident_id',
    'reserved_on',
])]
class Reservation extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    /** The statuses a booking can still move out of: undecided or holding the day. */
    public const OPEN_STATUSES = ['pending', 'observed', 'approved'];

    /**
     * Status, snapshots, and audit columns move only through the domain
     * methods and actions, never mass assignment.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ReservationStatus::class,
            'reserved_on' => 'immutable_date',
            'decided_at' => 'datetime',
        ];
    }

    /** Today's date in the Location's calendar, the reference every day rule uses (ADR 0043). */
    public function todayLocal(): CarbonImmutable
    {
        $this->loadMissing('location');

        return CarbonImmutable::now($this->location->timezone)->startOfDay();
    }

    /** The booked day has not yet passed in the Location's timezone. */
    public function isTodayOrLater(): bool
    {
        return $this->reserved_on->toDateString() >= $this->todayLocal()->toDateString();
    }

    /** "Completada" is presentation, not state: approved and the day is over. */
    public function isCompleted(): bool
    {
        return $this->status === ReservationStatus::Approved && ! $this->isTodayOrLater();
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
     * @return BelongsTo<Amenity, $this>
     */
    public function amenity(): BelongsTo
    {
        return $this->belongsTo(Amenity::class);
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
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    /**
     * The ledger rows this booking opened on approval (ADR 0034).
     *
     * @return HasMany<FinancialMovement, $this>
     */
    public function movements(): HasMany
    {
        return $this->hasMany(FinancialMovement::class)->orderBy('category');
    }
}
