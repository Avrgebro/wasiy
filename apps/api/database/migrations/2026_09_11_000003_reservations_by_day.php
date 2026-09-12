<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ADR 0043: a reservation is a Unit's booking of an Amenity for one calendar
 * day. Amenities open on weekdays (`open_days`) with an optional
 * `daily_capacity`; reservations keep only `reserved_on`, the local date of
 * the old `starts_at`.
 */
return new class extends Migration
{
    private const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    public function up(): void
    {
        Schema::table('amenities', function (Blueprint $table): void {
            $table->json('open_days')->default('[]')->after('booking_mode');
            $table->unsignedSmallInteger('daily_capacity')->nullable()->after('open_days');
        });

        // A weekday with at least one window is an open day.
        DB::table('amenities')->select(['id', 'availability'])->orderBy('id')->chunk(200, function ($amenities): void {
            foreach ($amenities as $amenity) {
                $availability = is_string($amenity->availability) ? json_decode($amenity->availability, true) : (array) $amenity->availability;
                $openDays = array_values(array_filter(
                    self::WEEKDAYS,
                    fn (string $day): bool => ($availability[$day] ?? []) !== [],
                ));

                DB::table('amenities')->where('id', $amenity->id)->update(['open_days' => json_encode($openDays)]);
            }
        });

        Schema::table('amenities', function (Blueprint $table): void {
            $table->dropColumn(['availability', 'slot_minutes']);
        });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->date('reserved_on')->nullable()->after('resident_id');
        });

        // The local date of the old start, in the location's timezone.
        DB::table('reservations')
            ->join('locations', 'locations.id', '=', 'reservations.location_id')
            ->select(['reservations.id', 'reservations.starts_at', 'locations.timezone'])
            ->orderBy('reservations.id')
            ->chunk(500, function ($reservations): void {
                foreach ($reservations as $reservation) {
                    $localDate = CarbonImmutable::parse($reservation->starts_at, 'UTC')
                        ->setTimezone($reservation->timezone)
                        ->toDateString();

                    DB::table('reservations')->where('id', $reservation->id)->update(['reserved_on' => $localDate]);
                }
            });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->dropIndex(['amenity_id', 'starts_at']);
            $table->dropIndex(['location_id', 'starts_at']);
            $table->dropColumn(['starts_at', 'ends_at']);
        });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->date('reserved_on')->nullable(false)->change();
            $table->index(['amenity_id', 'reserved_on']);
            $table->index(['location_id', 'reserved_on']);
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
        });

        DB::table('reservations')
            ->join('locations', 'locations.id', '=', 'reservations.location_id')
            ->select(['reservations.id', 'reservations.reserved_on', 'locations.timezone'])
            ->orderBy('reservations.id')
            ->chunk(500, function ($reservations): void {
                foreach ($reservations as $reservation) {
                    $day = CarbonImmutable::parse($reservation->reserved_on, $reservation->timezone);

                    DB::table('reservations')->where('id', $reservation->id)->update([
                        'starts_at' => $day->startOfDay()->utc(),
                        'ends_at' => $day->setTime(23, 59)->utc(),
                    ]);
                }
            });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->dropIndex(['amenity_id', 'reserved_on']);
            $table->dropIndex(['location_id', 'reserved_on']);
            $table->dropColumn('reserved_on');
            $table->index(['amenity_id', 'starts_at']);
            $table->index(['location_id', 'starts_at']);
        });

        Schema::table('amenities', function (Blueprint $table): void {
            $table->json('availability')->nullable();
            $table->unsignedSmallInteger('slot_minutes')->default(60);
        });

        DB::table('amenities')->select(['id', 'open_days'])->orderBy('id')->chunk(200, function ($amenities): void {
            foreach ($amenities as $amenity) {
                $openDays = is_string($amenity->open_days) ? json_decode($amenity->open_days, true) : (array) $amenity->open_days;
                $availability = [];
                foreach ($openDays as $day) {
                    $availability[$day] = [['start' => '00:00', 'end' => '24:00']];
                }

                DB::table('amenities')->where('id', $amenity->id)->update(['availability' => json_encode($availability)]);
            }
        });

        Schema::table('amenities', function (Blueprint $table): void {
            $table->dropColumn(['open_days', 'daily_capacity']);
        });
    }
};
