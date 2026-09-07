<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['source', 'name', 'email', 'phone', 'organization', 'profile', 'units', 'units_range', 'interests', 'preferred_slot', 'message', 'ip', 'user_agent'])]
class Lead extends Model
{
    use HasFactory, HasUlids;

    public const SOURCES = ['contacto', 'demo'];

    protected function casts(): array
    {
        return ['interests' => 'array', 'units' => 'integer'];
    }
}
