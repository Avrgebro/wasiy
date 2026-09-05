<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M9: what a Peruvian condominio tracks per home — type, area, alícuota,
 * monthly fee — plus parking and storage as labels. Dues generation keys
 * on financial_movements.period so a month is never issued twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('units', function (Blueprint $table) {
            $table->string('type')->default('apartment')->after('unit_number');
            $table->decimal('area_m2', 8, 2)->nullable()->after('floor');
            // Alícuota as a percentage, e.g. 1.180.
            $table->decimal('participation_share', 6, 3)->nullable()->after('area_m2');
            // Whole soles, like every amount in the app.
            $table->unsignedInteger('maintenance_fee')->nullable()->after('participation_share');
            // Comma-separated labels ("E-12, E-13"); not units of their own.
            $table->string('parking_spots')->nullable()->after('maintenance_fee');
            $table->string('storage_rooms')->nullable()->after('parking_spots');
        });

        Schema::table('financial_movements', function (Blueprint $table) {
            $table->string('period', 7)->nullable()->after('occurred_on');
            $table->unique(['unit_id', 'category', 'period']);
        });
    }

    public function down(): void
    {
        Schema::table('financial_movements', function (Blueprint $table) {
            $table->dropUnique(['unit_id', 'category', 'period']);
            $table->dropColumn('period');
        });

        Schema::table('units', function (Blueprint $table) {
            $table->dropColumn(['type', 'area_m2', 'participation_share', 'maintenance_fee', 'parking_spots', 'storage_rooms']);
        });
    }
};
