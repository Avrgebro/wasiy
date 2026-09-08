<?php

namespace App\Actions\Photos;

use App\Models\Account;
use App\Models\Photo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Shared by every photoable owner so Location and Amenity photos cannot
 * diverge: one cap, one path scheme, one cover rule.
 */
class StorePhoto
{
    public function handle(Model $owner, Account $account, UploadedFile $file): Photo
    {
        return DB::transaction(function () use ($owner, $account, $file): Photo {
            // Lock the owner's photos so concurrent uploads cannot both pass
            // the cap check or claim the same sort position.
            $existing = $owner->photos()->lockForUpdate()->get();

            $max = (int) config('wasiy.photos.max_per_owner');

            if ($existing->count() >= $max) {
                throw ValidationException::withMessages([
                    'file' => __('This record already has the maximum of :max photos.', ['max' => $max]),
                ]);
            }

            // Every upload lands on the app's default disk (FILESYSTEM_DISK);
            // the row records which one so reads survive a later switch.
            $disk = (string) config('filesystems.default');
            $path = $file->storePubliclyAs(
                "photos/{$account->id}",
                Str::ulid()->toBase32().'.'.$file->extension(),
                ['disk' => $disk],
            );

            return $owner->photos()->create([
                'account_id' => $account->id,
                'disk' => $disk,
                'path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => (string) $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'sort_order' => ($existing->max('sort_order') ?? -1) + 1,
                // The first photo becomes the cover; the tiles always have
                // an image once any photo exists.
                'is_cover' => ! $existing->contains('is_cover', true),
            ]);
        });
    }
}
