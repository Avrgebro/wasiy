<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nothing computes from the area: dues come from the fee, the share of
 * common expenses from the participation percentage. Dropped to keep the
 * unit form to what the operation uses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('units', function (Blueprint $table) {
            $table->dropColumn('area_m2');
        });
    }

    public function down(): void
    {
        Schema::table('units', function (Blueprint $table) {
            $table->decimal('area_m2', 8, 2)->nullable()->after('floor');
        });
    }
};
