<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['account_id', 'subscription_id', 'number', 'period_starts_on', 'period_ends_on', 'billable_units', 'unit_price_minor', 'amount_minor', 'currency', 'status', 'due_on', 'issued_at', 'paid_at', 'payment_method', 'rejection_reason'])]
class Invoice extends Model
{
    use HasFactory, HasUlids;

    protected function casts(): array
    {
        return [
            'status' => InvoiceStatus::class,
            'payment_method' => PaymentMethod::class,
            'period_starts_on' => 'immutable_date',
            'period_ends_on' => 'immutable_date',
            'due_on' => 'immutable_date',
            'issued_at' => 'immutable_datetime',
            'paid_at' => 'immutable_datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    /**
     * Pending, under review or rejected: anything still waiting on money.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', [InvoiceStatus::Pending->value, InvoiceStatus::UnderReview->value, InvoiceStatus::Rejected->value]);
    }
}
