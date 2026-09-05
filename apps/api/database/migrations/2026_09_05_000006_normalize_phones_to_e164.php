<?php

use App\Support\PhoneNumber;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One format for every stored phone (E.164). Existing values were typed
 * freely; parse each with its Location's country (residents through their
 * memberships), and leave anything unparseable untouched for a human.
 */
return new class extends Migration
{
    public function up(): void
    {
        $countryOfLocation = DB::table('locations')->pluck('country', 'id')->all();

        foreach (DB::table('locations')->whereNotNull('phone')->get(['id', 'phone', 'country']) as $location) {
            DB::table('locations')->where('id', $location->id)->update(['phone' => PhoneNumber::normalizeLenient($location->phone, $location->country ?? 'PE')]);
        }

        foreach (DB::table('visits')->whereNotNull('phone')->get(['id', 'phone', 'location_id']) as $visit) {
            DB::table('visits')->where('id', $visit->id)->update(['phone' => PhoneNumber::normalizeLenient($visit->phone, $countryOfLocation[$visit->location_id] ?? 'PE')]);
        }

        foreach (DB::table('residents')->whereNotNull('phone')->get(['id', 'phone']) as $resident) {
            $locationId = DB::table('unit_memberships')->where('resident_id', $resident->id)->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")->value('location_id');
            DB::table('residents')->where('id', $resident->id)->update(['phone' => PhoneNumber::normalizeLenient($resident->phone, $countryOfLocation[$locationId] ?? 'PE')]);
        }
    }

    public function down(): void
    {
        // Formatting only; nothing to restore.
    }
};
