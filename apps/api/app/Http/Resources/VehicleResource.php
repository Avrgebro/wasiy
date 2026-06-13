<?php

namespace App\Http\Resources;

use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Vehicle
 */
class VehicleResource extends JsonResource
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
            'unit_id' => $this->unit_id,
            'vehicle_type' => $this->vehicle_type->value,
            'plate' => $this->plate,
            'make' => $this->make,
            'model' => $this->model,
            'color' => $this->color,
            'status' => $this->status->value,
            'notes' => $this->notes,
            'unit' => $this->whenLoaded('unit', fn () => [
                'id' => $this->unit->id,
                'unit_number' => $this->unit->unit_number,
                'building_name' => $this->unit->building_name,
                'floor' => $this->unit->floor,
            ]),
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
