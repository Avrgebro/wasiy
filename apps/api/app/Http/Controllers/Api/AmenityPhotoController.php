<?php

namespace App\Http\Controllers\Api;

use App\Actions\Photos\ReorderPhotos;
use App\Actions\Photos\SetCoverPhoto;
use App\Actions\Photos\StorePhoto;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReorderPhotosRequest;
use App\Http\Requests\StorePhotoRequest;
use App\Http\Resources\PhotoResource;
use App\Models\Account;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\Photo;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * Same shared photo actions as Locations, authorized by the Amenity's
 * update ability.
 */
class AmenityPhotoController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function store(
        StorePhotoRequest $request,
        Account $account,
        Location $location,
        Amenity $amenity,
        StorePhoto $storePhoto,
    ): JsonResponse {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $amenity);

        $photo = $storePhoto->handle($amenity, $account, $request->file('file'));

        return (new PhotoResource($photo))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Account $account, Location $location, Amenity $amenity, Photo $photo): Response
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $amenity);

        $photo->delete();

        return response()->noContent();
    }

    public function reorder(
        ReorderPhotosRequest $request,
        Account $account,
        Location $location,
        Amenity $amenity,
        ReorderPhotos $reorderPhotos,
    ): AnonymousResourceCollection {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $amenity);

        $reorderPhotos->handle($amenity, $request->validated('photo_ids'));

        return PhotoResource::collection($amenity->photos()->get());
    }

    public function cover(
        Request $request,
        Account $account,
        Location $location,
        Amenity $amenity,
        Photo $photo,
        SetCoverPhoto $setCoverPhoto,
    ): PhotoResource {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $amenity);

        return new PhotoResource($setCoverPhoto->handle($amenity, $photo));
    }

    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }
}
