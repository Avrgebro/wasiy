<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ResidentAlertResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'unit_id' => $this->unit_id,
            'kind' => $this->kind->value,
            'family' => $this->kind->family()->value,
            'title' => $this->title,
            'body' => $this->body,
            'subject_type' => $this->subject_type,
            'subject_id' => $this->subject_id,
            'read_at' => $this->read_at?->toJSON(),
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
