<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['code', 'name', 'unit_price_minor', 'currency', 'location_limit', 'included_units', 'features', 'is_available'])]
class Plan extends Model
{
    use HasFactory, HasUlids;

    protected function casts(): array
    {
        return ['features' => 'array', 'is_available' => 'boolean', 'unit_price_minor' => 'integer', 'location_limit' => 'integer', 'included_units' => 'integer'];
    }
}
