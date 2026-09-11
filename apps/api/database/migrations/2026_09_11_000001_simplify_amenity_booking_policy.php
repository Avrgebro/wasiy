<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ADR 0041: a reservation is an exclusive run of consecutive slots inside an
 * availability window. One `slot_minutes` replaces the seven policy knobs.
 */
return new class extends Migration
{
    private const DROPPED = [
        'capacity',
        'buffer_minutes',
        'min_duration_minutes',
        'max_duration_minutes',
        'max_advance_days',
        'max_concurrent_per_unit',
        'cancellation_window_hours',
    ];

    public function up(): void
    {
        Schema::table('amenities', function (Blueprint $table) {
            $table->unsignedSmallInteger('slot_minutes')->default(60)->after('availability');
        });

        // The old minimum duration is the closest thing to a slot length.
        DB::table('amenities')
            ->whereNotNull('min_duration_minutes')
            ->whereRaw('min_duration_minutes % 30 = 0')
            ->where('min_duration_minutes', '>=', 30)
            ->where('min_duration_minutes', '<=', 720)
            ->update(['slot_minutes' => DB::raw('min_duration_minutes')]);

        Schema::table('amenities', function (Blueprint $table) {
            $table->dropColumn(self::DROPPED);
        });
    }

    public function down(): void
    {
        Schema::table('amenities', function (Blueprint $table) {
            $table->unsignedInteger('capacity')->nullable();
            $table->unsignedInteger('buffer_minutes')->nullable();
            $table->unsignedInteger('min_duration_minutes')->nullable();
            $table->unsignedInteger('max_duration_minutes')->nullable();
            $table->unsignedInteger('max_advance_days')->nullable();
            $table->unsignedInteger('max_concurrent_per_unit')->nullable();
            $table->unsignedInteger('cancellation_window_hours')->nullable();
        });

        DB::table('amenities')->update(['min_duration_minutes' => DB::raw('slot_minutes')]);

        Schema::table('amenities', function (Blueprint $table) {
            $table->dropColumn('slot_minutes');
        });
    }
};
