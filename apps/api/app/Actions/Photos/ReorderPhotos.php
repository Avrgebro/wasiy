<?php

namespace App\Actions\Photos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReorderPhotos
{
    /**
     * The list must be a full permutation of the owner's photos: an id from
     * another owner, a missing id, or a duplicate all reject, so a stale
     * client cannot silently scramble positions.
     *
     * @param  array<int, string>  $photoIds
     */
    public function handle(Model $owner, array $photoIds): void
    {
        DB::transaction(function () use ($owner, $photoIds): void {
            $currentIds = $owner->photos()->lockForUpdate()->pluck('id');

            $isPermutation = count($photoIds) === $currentIds->count()
                && count($photoIds) === count(array_unique($photoIds))
                && $currentIds->diff($photoIds)->isEmpty();

            if (! $isPermutation) {
                throw ValidationException::withMessages([
                    'photo_ids' => __('The photo list does not match this record\'s photos.'),
                ]);
            }

            foreach (array_values($photoIds) as $sortOrder => $photoId) {
                $owner->photos()->whereKey($photoId)->update(['sort_order' => $sortOrder]);
            }
        });
    }
}
