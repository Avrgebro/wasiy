<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
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
        return ['status' => SubscriptionStatus::class, 'trial_starts_at' => 'immutable_datetime', 'trial_ends_at' => 'immutable_datetime', 'access_until' => 'immutable_datetime', 'terms_accepted_at' => 'immutable_datetime'];
    }

    /** The gate reads the date, not the status, so a lapse takes effect on time regardless of the scheduler. */
    public function isLapsed(?CarbonImmutable $now = null): bool
    {
        return $this->access_until->lte($now ?? CarbonImmutable::now());
    }

    /** Whole days until access ends, never negative; the banner countdown. */
    public function daysLeft(?CarbonImmutable $now = null): int
    {
        $now = $now ?? CarbonImmutable::now();

        return $this->isLapsed($now) ? 0 : (int) ceil($now->diffInSeconds($this->access_until) / 86400);
    }

    /**
     * Rows whose access has run out but whose status still says otherwise.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeLapsedButNotExpired(Builder $query): Builder
    {
        return $query
            ->whereIn('status', [SubscriptionStatus::Trialing->value, SubscriptionStatus::Active->value])
            ->where('access_until', '<=', now());
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
