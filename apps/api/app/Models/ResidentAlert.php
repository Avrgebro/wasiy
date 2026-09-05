<?php

namespace App\Models;

use App\Enums\ResidentAlertKind;
use Database\Factories\ResidentAlertFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['account_id', 'location_id', 'unit_id', 'resident_id', 'kind', 'title', 'body', 'subject_type', 'subject_id'])]
class ResidentAlert extends Model
{
    /** @use HasFactory<ResidentAlertFactory> */
    use HasFactory, HasUlids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'kind' => ResidentAlertKind::class,
            'read_at' => 'immutable_datetime',
        ];
    }

    /** @param  Builder<ResidentAlert>  $query */
    public function scopeUnread(Builder $query): void
    {
        $query->whereNull('read_at');
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}
