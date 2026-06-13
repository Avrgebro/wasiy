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
