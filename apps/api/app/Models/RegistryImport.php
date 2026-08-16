<?php

namespace App\Models;

use App\Enums\ImportStatus;
use App\Enums\ImportType;
use Database\Factories\RegistryImportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

#[Fillable([
    'account_id',
    'location_id',
    'requested_by_user_id',
    'import_type',
    'status',
    'original_filename',
    'disk',
    'path',
    'total_rows',
    'valid_rows',
    'error_rows',
    'duplicate_rows',
    'warning_rows',
    'confirmed_at',
    'completed_at',
    'failed_at',
    'failure_reason',
])]
class RegistryImport extends Model
{
    /** @use HasFactory<RegistryImportFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'import_type' => ImportType::class,
            'status' => ImportStatus::class,
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    /**
     * Mark the import confirmed for commit. Owns the state-transition rules
     * so every entry point (HTTP, jobs, future CLI) agrees on them.
     */
    public function confirm(): void
    {
        if ($this->status !== ImportStatus::ReadyForReview || $this->confirmed_at !== null) {
            throw ValidationException::withMessages([
                'import' => __('Only imports ready for review can be confirmed.'),
            ]);
        }

        if ($this->error_rows > 0) {
            throw ValidationException::withMessages([
                'import' => __('Imports with blocking row errors cannot be confirmed.'),
            ]);
        }

        $this->forceFill([
            'confirmed_at' => now(),
        ])->save();
    }

    /**
     * Reset a failed, unconfirmed import back to Pending for re-validation.
     */
    public function retryValidation(): void
    {
        if ($this->status !== ImportStatus::Failed || $this->confirmed_at !== null) {
            throw ValidationException::withMessages([
                'import' => __('Only failed validation imports can be retried.'),
            ]);
        }

        if ($this->disk === null || $this->path === null || ! Storage::disk($this->disk)->exists($this->path)) {
            throw ValidationException::withMessages([
                'import' => __('The original import file is no longer available.'),
            ]);
        }

        $this->forceFill([
            'status' => ImportStatus::Pending,
            'failed_at' => null,
            'failure_reason' => null,
        ])->save();
    }

    /**
     * The import's own summary shape for activity-log entries.
     *
     * @return array<string, mixed>
     */
    public function activityMetadata(): array
    {
        return [
            'import_id' => $this->id,
            'import_type' => $this->import_type->value,
            'filename' => $this->original_filename,
            'location_id' => $this->location_id,
            'total_rows' => $this->total_rows,
            'valid_rows' => $this->valid_rows,
            'error_rows' => $this->error_rows,
            'duplicate_rows' => $this->duplicate_rows,
            'warning_rows' => $this->warning_rows,
            'actor_user_id' => $this->requested_by_user_id,
        ];
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
     * @return BelongsTo<User, $this>
     */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    /**
     * @return HasMany<RegistryImportRow, $this>
     */
    public function rows(): HasMany
    {
        return $this->hasMany(RegistryImportRow::class);
    }
}
