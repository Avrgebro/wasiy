<?php

namespace App\Models;

use App\Enums\ExportStatus;
use App\Enums\ExportType;
use Database\Factories\RegistryExportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'account_id',
    'location_id',
    'requested_by_user_id',
    'export_type',
    'filters',
    'status',
    'disk',
    'path',
    'filename',
    'expires_at',
    'completed_at',
    'failed_at',
    'failure_reason',
])]
class RegistryExport extends Model
{
    /** @use HasFactory<RegistryExportFactory> */
    use HasFactory, HasUlids;

    protected $table = 'exports';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'export_type' => ExportType::class,
            'filters' => 'array',
            'status' => ExportStatus::class,
            'expires_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    /**
     * Atomically claim the export for a worker: a conditional update
     * guarantees only one worker transitions it into Processing. Refreshes
     * the model on success.
     */
    public function claimProcessing(): bool
    {
        $claimed = static::query()
            ->whereKey($this->id)
            ->where('status', ExportStatus::Pending)
            ->update([
                'status' => ExportStatus::Processing,
                'failure_reason' => null,
                'failed_at' => null,
            ]);

        if ($claimed !== 1) {
            return false;
        }

        $this->refresh();

        return true;
    }

    public function markFailed(string $reason): void
    {
        $this->forceFill([
            'status' => ExportStatus::Failed,
            'failed_at' => now(),
            'failure_reason' => $reason,
        ])->save();
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
}
