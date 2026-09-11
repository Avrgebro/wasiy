<?php

namespace Database\Seeders;

use App\Enums\BookingMode;
use App\Models\Account;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\Photo;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * M6 demo data: the settings cascade with a real override, one deactivated
 * Location, the Amenity matrix from the mockups (instant/free, approval
 * with fee and deposit, instant with fee, common space, deactivated), and
 * generated cover photos so the tiles and galleries render.
 */
class DemoLocationsSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $account = Account::query()->where('slug', 'wasiy-demo')->sole();
        $central = Location::query()->where('slug', 'edificio-central')->sole();
        $admin = User::query()->where('email', 'admin@wasiy.test')->sole();

        // The cascade with something real to show: the account sets the
        // default, Edificio Central overrides it.
        $account->forceFill(['settings' => [
            'visitor_auto_checkout_hours' => 24,
        ]])->save();
        $central->forceFill(['settings' => [
            'visitor_auto_checkout_hours' => 12,
        ]])->save();

        // One retired property, kept with history and no photos.
        $jardines = Location::query()->where('slug', 'jardines-de-miraflores')->sole();

        if (! $jardines->isDeactivated()) {
            $jardines->deactivate($admin);
        }

        $this->amenity($central, 'salon-de-eventos', [
            'name' => 'Salón de eventos',
            'description' => 'Salón con cocina de apoyo, proyector y capacidad para 80 personas sentadas.',
            'is_reservable' => true,
            'booking_mode' => BookingMode::Approval,
            'availability' => $this->everyDay('09:00', '22:00'),
            // Events are booked in half-day blocks.
            'slot_minutes' => 360,
            'fee_amount_minor' => 15000,
            'deposit_amount_minor' => 30000,
        ]);

        $this->amenity($central, 'gimnasio', [
            'name' => 'Gimnasio',
            'is_reservable' => true,
            'booking_mode' => BookingMode::Instant,
            'availability' => $this->everyDay('05:00', '23:00'),
        ]);

        $this->amenity($central, 'parrilla-terraza', [
            'name' => 'Parrilla / terraza',
            'is_reservable' => true,
            'booking_mode' => BookingMode::Instant,
            'slot_minutes' => 120,
            'availability' => [
                'friday' => [['start' => '12:00', 'end' => '22:00']],
                'saturday' => [['start' => '12:00', 'end' => '22:00']],
                'sunday' => [['start' => '12:00', 'end' => '22:00']],
            ],
            'fee_amount_minor' => 5000,
        ]);

        $this->amenity($central, 'lobby-recepcion', [
            'name' => 'Lobby / recepción',
            'is_reservable' => false,
        ]);

        $squash = $this->amenity($central, 'cancha-de-squash', [
            'name' => 'Cancha de squash',
            'is_reservable' => true,
            'booking_mode' => BookingMode::Instant,
            'availability' => $this->everyDay('06:00', '21:00'),
        ]);

        if (! $squash->isDeactivated()) {
            $squash->deactivate();
        }

        // Generated covers so the tiles and galleries render real images.
        $this->photo($central, 'Fachada', '#124E52', isCover: true);
        $this->photo($central, 'Lobby', '#3E7C80');
        $eventRoom = Amenity::query()->where('slug', 'salon-de-eventos')->sole();
        $this->photo($eventRoom, 'Salón', '#B07D2B', isCover: true);
    }

    /**
     * @return array<string, array<int, array{start: string, end: string}>>
     */
    private function everyDay(string $start, string $end): array
    {
        return collect(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
            ->mapWithKeys(fn (string $day) => [$day => [['start' => $start, 'end' => $end]]])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function amenity(Location $location, string $slug, array $attributes): Amenity
    {
        return Amenity::query()->updateOrCreate(
            ['location_id' => $location->id, 'slug' => $slug],
            [...$attributes, 'account_id' => $location->account_id],
        );
    }

    /**
     * One solid-color JPEG per (owner, label), regenerated in place so the
     * seeder stays idempotent without stacking duplicate photos.
     */
    private function photo(Location|Amenity $owner, string $label, string $hexColor, bool $isCover = false): void
    {
        $existing = $owner->photos()->where('original_filename', "{$label}.jpg")->first();

        if ($existing instanceof Photo) {
            return;
        }

        $disk = (string) config('filesystems.default');
        $path = "photos/{$owner->account_id}/".Str::ulid()->toBase32().'.jpg';

        [$red, $green, $blue] = sscanf($hexColor, '#%02x%02x%02x');
        $image = imagecreatetruecolor(640, 400);
        imagefill($image, 0, 0, imagecolorallocate($image, $red, $green, $blue));
        ob_start();
        imagejpeg($image, null, 80);
        $contents = (string) ob_get_clean();
        imagedestroy($image);

        Storage::disk($disk)->put($path, $contents);

        $owner->photos()->create([
            'account_id' => $owner->account_id,
            'disk' => $disk,
            'path' => $path,
            'original_filename' => "{$label}.jpg",
            'mime_type' => 'image/jpeg',
            'size_bytes' => strlen($contents),
            'sort_order' => ($owner->photos()->max('sort_order') ?? -1) + 1,
            'is_cover' => $isCover,
        ]);
    }
}
