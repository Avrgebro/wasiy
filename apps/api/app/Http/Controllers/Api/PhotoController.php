<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Photo;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams the photo bytes through the API so authorization applies on read
 * — the SPA renders <img src="/api/photos/{id}"> with its session cookie —
 * and the storage disk never needs to be publicly reachable.
 */
class PhotoController extends Controller
{
    public function show(Photo $photo): StreamedResponse
    {
        Gate::authorize('view', $photo->photoable);

        abort_unless(Storage::disk($photo->disk)->exists($photo->path), 404);

        return Storage::disk($photo->disk)->response($photo->path, $photo->original_filename, [
            'Cache-Control' => 'private, max-age=31536000, immutable',
        ]);
    }
}
