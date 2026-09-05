<?php

namespace App\Actions\Photos;

use App\Models\Photo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class SetCoverPhoto
{
    /**
     * Zero or one cover per owner: promoting a photo demotes the previous
     * cover in the same transaction.
     */
    public function handle(Model $owner, Photo $photo): Photo
    {
        return DB::transaction(function () use ($owner, $photo): Photo {
            $owner->photos()->lockForUpdate()->get();

            $owner->photos()->where('is_cover', true)->whereKeyNot($photo->id)->update(['is_cover' => false]);
            $photo->forceFill(['is_cover' => true])->save();

            return $photo;
        });
    }
}
