<?php

namespace App\Http\Resources;

use App\Models\RegistryImport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin RegistryImport
 */
class RegistryImportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'location_id' => $this->location_id,
            'requested_by_user_id' => $this->requested_by_user_id,
            'import_type' => $this->import_type->value,
            'status' => $this->status->value,
            'original_filename' => $this->original_filename,
            'total_rows' => $this->total_rows,
            'valid_rows' => $this->valid_rows,
            'error_rows' => $this->error_rows,
            'duplicate_rows' => $this->duplicate_rows,
            'warning_rows' => $this->warning_rows,
            'confirmed_at' => $this->confirmed_at?->toJSON(),
            'completed_at' => $this->completed_at?->toJSON(),
            'failed_at' => $this->failed_at?->toJSON(),
            'failure_reason' => $this->failure_reason,
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
