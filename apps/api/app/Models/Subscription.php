<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['account_id', 'plan_id', 'status', 'unit_price_minor', 'billable_units', 'currency', 'trial_starts_at', 'trial_ends_at', 'access_until', 'terms_accepted_at'])]
class Subscription extends Model
{
    use HasFactory, HasUlids;

    protected function casts(): array
    {
        return ['trial_starts_at' => 'immutable_datetime', 'trial_ends_at' => 'immutable_datetime', 'access_until' => 'immutable_datetime', 'terms_accepted_at' => 'immutable_datetime'];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
