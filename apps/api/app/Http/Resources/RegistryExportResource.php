<?php

namespace App\Http\Resources;

use App\Models\RegistryExport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin RegistryExport
 */
class RegistryExportResource extends JsonResource
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
            'export_type' => $this->export_type->value,
            'filters' => $this->filters,
            'status' => $this->status->value,
            'filename' => $this->filename,
            'expires_at' => $this->expires_at?->toJSON(),
            'completed_at' => $this->completed_at?->toJSON(),
            'failed_at' => $this->failed_at?->toJSON(),
            'failure_reason' => $this->failure_reason,
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
