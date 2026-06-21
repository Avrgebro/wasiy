<?php

namespace App\Models;

use App\Enums\ImportRowStatus;
use Database\Factories\RegistryImportRowFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'registry_import_id',
    'account_id',
    'location_id',
    'row_number',
    'status',
    'raw_data',
    'normalized_data',
    'errors',
    'warnings',
    'duplicate_key',
    'committed_unit_id',
    'committed_resident_id',
    'committed_unit_membership_id',
])]
class RegistryImportRow extends Model
{
    /** @use HasFactory<RegistryImportRowFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ImportRowStatus::class,
            'raw_data' => 'array',
            'normalized_data' => 'array',
            'errors' => 'array',
            'warnings' => 'array',
        ];
    }

    /**
     * @return BelongsTo<RegistryImport, $this>
     */
    public function registryImport(): BelongsTo
    {
        return $this->belongsTo(RegistryImport::class);
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
}
