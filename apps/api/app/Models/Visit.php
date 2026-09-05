<?php

namespace App\Models;

use App\Enums\VisitConfirmation;
use App\Enums\VisitStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['account_id', 'location_id', 'unit_id', 'resident_id', 'visitor_name', 'document', 'phone', 'confirmation', 'notes'])]
class Visit extends Model
{
    use HasFactory, HasUlids;

    /**
     * Status and audit columns move only through the actions.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'confirmation' => VisitConfirmation::class,
            'status' => VisitStatus::class,
            'expected_on' => 'immutable_date',
            'pre_registered_at' => 'immutable_datetime',
            'checked_in_at' => 'immutable_datetime',
            'checked_out_at' => 'immutable_datetime',
            'cancelled_at' => 'immutable_datetime',
            'auto_checked_out' => 'boolean',
        ];
    }

    /** @return BelongsTo<Account, $this> */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /** @return BelongsTo<Location, $this> */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<Resident, $this> */
    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    /** @return BelongsTo<Resident, $this> */
    public function preRegisteredBy(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'pre_registered_by');
    }

    /** @return BelongsTo<User, $this> */
    public function checkedInBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_in_by');
    }

    /** @return BelongsTo<User, $this> */
    public function checkedOutBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_out_by');
    }
}
