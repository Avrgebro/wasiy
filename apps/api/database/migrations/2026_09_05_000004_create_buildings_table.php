<?php

use App\Models\Building;
use App\Models\Location;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Towers become rows (ADR 0037). Every Location gets one unnamed default
 * Building; each distinct building_name in use becomes a named Building;
 * units then point at their Building and the free-text column goes away.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('buildings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            // Null only while the Location has a single Building.
            $table->string('name', 80)->nullable();
            // The short form the UI prefixes unit numbers with ("T1-402").
            $table->string('code', 8)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->index(['location_id', 'sort_order']);
        });
        DB::statement('CREATE UNIQUE INDEX buildings_location_name_unique ON buildings (location_id, LOWER(name)) WHERE name IS NOT NULL');

        Schema::table('units', function (Blueprint $table) {
            $table->foreignUlid('building_id')->nullable()->after('location_id');
        });

        Location::withTrashed()->each(function (Location $location): void {
            $names = DB::table('units')->where('location_id', $location->id)
                ->whereNotNull('building_name')->where('building_name', '!=', '')
                ->distinct()->orderBy('building_name')->pluck('building_name');
            $unnamedUnits = DB::table('units')->where('location_id', $location->id)
                ->where(fn ($query) => $query->whereNull('building_name')->orWhere('building_name', ''))->count();

            // The default Building: unnamed unless it must sit next to named towers.
            $default = Building::query()->create([
                'account_id' => $location->account_id,
                'location_id' => $location->id,
                'name' => $names->isNotEmpty() && $unnamedUnits > 0 ? 'Principal' : null,
                'sort_order' => 0,
            ]);
            DB::table('units')->where('location_id', $location->id)
                ->where(fn ($query) => $query->whereNull('building_name')->orWhere('building_name', ''))
                ->update(['building_id' => $default->id]);

            foreach ($names->values() as $index => $name) {
                $building = Building::query()->create([
                    'account_id' => $location->account_id,
                    'location_id' => $location->id,
                    'name' => $name,
                    'sort_order' => $index + 1,
                ]);
                DB::table('units')->where('location_id', $location->id)->where('building_name', $name)->update(['building_id' => $building->id]);
            }

            if ($names->isNotEmpty() && $unnamedUnits === 0) {
                $default->delete();
            }
        });

        DB::statement('DROP INDEX IF EXISTS units_location_unit_number_building_unique');
        Schema::table('units', function (Blueprint $table) {
            $table->dropColumn('building_name');
        });
        DB::statement('ALTER TABLE units ALTER COLUMN building_id SET NOT NULL');
        Schema::table('units', function (Blueprint $table) {
            $table->foreign('building_id')->references('id')->on('buildings')->restrictOnDelete();
            $table->unique(['location_id', 'building_id', 'unit_number'], 'units_location_building_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('units', function (Blueprint $table) {
            $table->string('building_name')->nullable()->after('unit_number');
        });
        DB::statement('UPDATE units SET building_name = buildings.name FROM buildings WHERE buildings.id = units.building_id');
        Schema::table('units', function (Blueprint $table) {
            $table->dropUnique('units_location_building_number_unique');
            $table->dropForeign(['building_id']);
            $table->dropColumn('building_id');
        });
        DB::statement("CREATE UNIQUE INDEX units_location_unit_number_building_unique ON units (location_id, unit_number, COALESCE(building_name, ''))");
        Schema::dropIfExists('buildings');
    }
};
