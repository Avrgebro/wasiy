<?php

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\Photo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');
});

function photoAdmin(Account $account): User
{
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return $admin;
}

function uploadPhoto($test, Account $account, Location $location, User $admin, string $name = 'fachada.jpg')
{
    return $test->actingAs($admin)->post(
        "/api/accounts/{$account->id}/locations/{$location->id}/photos",
        ['file' => UploadedFile::fake()->image($name, 1200, 800)],
        ['Accept' => 'application/json'],
    );
}

test('uploading stores the file, the first photo becomes the cover, and bytes stream back', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = photoAdmin($account);

    $response = uploadPhoto($this, $account, $location, $admin)
        ->assertCreated()
        ->assertJsonPath('data.is_cover', true)
        ->assertJsonPath('data.sort_order', 0)
        ->assertJsonPath('data.original_filename', 'fachada.jpg');

    $photo = Photo::query()->findOrFail($response->json('data.id'));
    Storage::disk('local')->assertExists($photo->path);
    expect($photo->photoable_type)->toBe('location');

    uploadPhoto($this, $account, $location, $admin, 'lobby.jpg')
        ->assertCreated()
        ->assertJsonPath('data.is_cover', false)
        ->assertJsonPath('data.sort_order', 1);

    $this->actingAs($admin)->get("/api/photos/{$photo->id}")->assertOk();

    // The location detail carries the gallery and the cover URL.
    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}")
        ->assertJsonCount(2, 'data.photos')
        ->assertJsonPath('data.cover_photo_url', url("/api/photos/{$photo->id}"));
});

test('an eleventh photo is rejected', function () {
    config(['wasiy.photos.max_per_owner' => 2]);
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = photoAdmin($account);

    uploadPhoto($this, $account, $location, $admin, 'a.jpg')->assertCreated();
    uploadPhoto($this, $account, $location, $admin, 'b.jpg')->assertCreated();
    uploadPhoto($this, $account, $location, $admin, 'c.jpg')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file']);
});

test('an image extension with non-image content and an oversize file are rejected', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = photoAdmin($account);
    $base = "/api/accounts/{$account->id}/locations/{$location->id}/photos";

    // A raw UploadedFile, not the fake: the fake reports MIME from the
    // filename, but the mimetypes rule must sniff the actual content.
    $tmp = tempnam(sys_get_temp_dir(), 'photo');
    file_put_contents($tmp, 'not an image at all');
    $notAnImage = new UploadedFile($tmp, 'fake.png', 'image/png', null, true);

    $this->actingAs($admin)
        ->post($base, ['file' => $notAnImage], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file']);

    $this->actingAs($admin)
        ->post($base, ['file' => UploadedFile::fake()->create('huge.jpg', 11000, 'image/jpeg')], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file']);
});

test('deleting a photo removes the stored file', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = photoAdmin($account);

    $photoId = uploadPhoto($this, $account, $location, $admin)->json('data.id');
    $path = Photo::query()->findOrFail($photoId)->path;

    $this->actingAs($admin)
        ->deleteJson("/api/accounts/{$account->id}/locations/{$location->id}/photos/{$photoId}")
        ->assertNoContent();

    Storage::disk('local')->assertMissing($path);
    expect(Photo::query()->find($photoId))->toBeNull();
});

test('setting a cover clears the previous cover for that owner only', function () {
    $account = Account::factory()->create();
    $locationA = Location::factory()->for($account)->create();
    $locationB = Location::factory()->for($account)->create();
    $admin = photoAdmin($account);

    $coverA = uploadPhoto($this, $account, $locationA, $admin, 'a1.jpg')->json('data.id');
    $secondA = uploadPhoto($this, $account, $locationA, $admin, 'a2.jpg')->json('data.id');
    $coverB = uploadPhoto($this, $account, $locationB, $admin, 'b1.jpg')->json('data.id');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations/{$locationA->id}/photos/{$secondA}/cover")
        ->assertOk()
        ->assertJsonPath('data.is_cover', true);

    expect(Photo::query()->findOrFail($coverA)->is_cover)->toBeFalse()
        ->and(Photo::query()->findOrFail($coverB)->is_cover)->toBeTrue();
});

test('reordering rewrites positions and rejects a foreign or partial id list', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $other = Location::factory()->for($account)->create();
    $admin = photoAdmin($account);

    $first = uploadPhoto($this, $account, $location, $admin, '1.jpg')->json('data.id');
    $second = uploadPhoto($this, $account, $location, $admin, '2.jpg')->json('data.id');
    $foreign = uploadPhoto($this, $account, $other, $admin, 'x.jpg')->json('data.id');

    $base = "/api/accounts/{$account->id}/locations/{$location->id}/photos/order";

    $this->actingAs($admin)
        ->putJson($base, ['photo_ids' => [$second, $first]])
        ->assertOk()
        ->assertJsonPath('data.0.id', $second)
        ->assertJsonPath('data.1.id', $first);

    $this->actingAs($admin)
        ->putJson($base, ['photo_ids' => [$foreign, $first]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['photo_ids']);

    $this->actingAs($admin)
        ->putJson($base, ['photo_ids' => [$first]])
        ->assertUnprocessable();
});

test('cross-account upload and read are rejected', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = photoAdmin($account);
    $outsider = photoAdmin(Account::factory()->create());

    $photoId = uploadPhoto($this, $account, $location, $admin)->json('data.id');

    $this->actingAs($outsider)
        ->post("/api/accounts/{$account->id}/locations/{$location->id}/photos",
            ['file' => UploadedFile::fake()->image('x.jpg')],
            ['Accept' => 'application/json'])
        ->assertNotFound();

    $this->actingAs($outsider)->get("/api/photos/{$photoId}")->assertForbidden();
});

test('a deactivated location has a read-only gallery', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    Location::factory()->for($account)->create();
    $admin = photoAdmin($account);

    $photoId = uploadPhoto($this, $account, $location, $admin)->json('data.id');
    $location->deactivate($admin);

    uploadPhoto($this, $account, $location, $admin, 'nuevo.jpg')->assertForbidden();
    $this->actingAs($admin)
        ->deleteJson("/api/accounts/{$account->id}/locations/{$location->id}/photos/{$photoId}")
        ->assertForbidden();
    // But viewing still works for the admin surface.
    $this->actingAs($admin)->get("/api/photos/{$photoId}")->assertOk();
});
