<?php

namespace App\Http\Resources;

use App\Models\RegistryImportRow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin RegistryImportRow
 */
class RegistryImportRowResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'registry_import_id' => $this->registry_import_id,
            'account_id' => $this->account_id,
            'location_id' => $this->location_id,
            'row_number' => $this->row_number,
            'status' => $this->status->value,
            'raw_data' => $this->raw_data,
            'normalized_data' => $this->normalized_data,
            'errors' => $this->errors,
            'warnings' => $this->warnings,
            'duplicate_key' => $this->duplicate_key,
            'committed_unit_id' => $this->committed_unit_id,
            'committed_resident_id' => $this->committed_resident_id,
            'committed_unit_membership_id' => $this->committed_unit_membership_id,
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
