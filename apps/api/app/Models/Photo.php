<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Storage;

/**
 * One uploaded photo of a photoable owner (Location now, Amenity in M6
 * slice 8). Owners hold at most a configured maximum, exactly zero or one
 * cover, and a contiguous sort order maintained by the photo actions.
 */
#[Fillable([
    'account_id',
    'photoable_type',
    'photoable_id',
    'disk',
    'path',
    'original_filename',
    'mime_type',
    'size_bytes',
    'sort_order',
    'is_cover',
])]
class Photo extends Model
{
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'sort_order' => 'integer',
            'is_cover' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // A photo row without its file is meaningless, so removal is a
        // model concern: every delete path drops the stored object too.
        static::deleted(function (Photo $photo): void {
            Storage::disk($photo->disk)->delete($photo->path);
        });
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function photoable(): MorphTo
    {
        return $this->morphTo();
    }
}
