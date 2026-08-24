<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->json('settings')->nullable()->after('timezone');
        });

        Schema::table('locations', function (Blueprint $table) {
            $table->json('settings')->nullable()->after('address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('settings');
        });

        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn('settings');
        });
    }
};
