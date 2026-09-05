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
 * Photo management delegates to the owner's policy: whoever may update the
 * Location may manage its photos, so a deactivated Location's gallery is as
 * read-only as the rest of its forms.
 */
class LocationPhotoController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function store(StorePhotoRequest $request, Account $account, Location $location, StorePhoto $storePhoto): JsonResponse
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $location);

        $photo = $storePhoto->handle($location, $account, $request->file('file'));

        return (new PhotoResource($photo))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Account $account, Location $location, Photo $photo): Response
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $location);

        $photo->delete();

        return response()->noContent();
    }

    public function reorder(ReorderPhotosRequest $request, Account $account, Location $location, ReorderPhotos $reorderPhotos): AnonymousResourceCollection
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $location);

        $reorderPhotos->handle($location, $request->validated('photo_ids'));

        return PhotoResource::collection($location->photos()->get());
    }

    public function cover(Request $request, Account $account, Location $location, Photo $photo, SetCoverPhoto $setCoverPhoto): PhotoResource
    {
        $this->authorizeAccount($request, $account);
        Gate::authorize('update', $location);

        return new PhotoResource($setCoverPhoto->handle($location, $photo));
    }

    private function authorizeAccount(Request $request, Account $account): void
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->access->canAccessAccount($user, $account), 404);
    }
}
