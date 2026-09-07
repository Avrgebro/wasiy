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
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['account_id', 'plan_id', 'requested_plan_id', 'plan_change_requested_at', 'status', 'unit_price_minor', 'billable_units', 'pending_billable_units', 'pending_units_from', 'currency', 'trial_starts_at', 'trial_ends_at', 'access_until', 'terms_accepted_at'])]
class Subscription extends Model
{
    use HasFactory, HasUlids;

    protected function casts(): array
    {
        return ['status' => SubscriptionStatus::class, 'pending_units_from' => 'immutable_date', 'plan_change_requested_at' => 'immutable_datetime', 'trial_starts_at' => 'immutable_datetime', 'trial_ends_at' => 'immutable_datetime', 'access_until' => 'immutable_datetime', 'terms_accepted_at' => 'immutable_datetime'];
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

    /** The scheduled decrease, when it is due by the given period start (ADR 0040). */
    public function pendingUnitsApplyOn(CarbonImmutable $periodStart): ?int
    {
        if ($this->pending_billable_units === null || $this->pending_units_from === null) {
            return null;
        }

        return $this->pending_units_from->lte($periodStart) ? (int) $this->pending_billable_units : null;
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

    public function requestedPlan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'requested_plan_id');
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /** The one invoice still waiting on money, if any; issuing never opens a second. */
    public function openInvoice(): ?Invoice
    {
        return $this->invoices()->open()->latest('issued_at')->first();
    }
}
