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
