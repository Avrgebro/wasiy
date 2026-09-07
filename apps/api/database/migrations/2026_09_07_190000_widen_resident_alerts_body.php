<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alert bodies quote what the desk typed (package notes, delivery notes,
 * reservation decisions), which the API accepts up to 1000 characters, so a
 * 255-character varchar rejected long notes at insert time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resident_alerts', function (Blueprint $table) {
            $table->text('body')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('resident_alerts', function (Blueprint $table) {
            $table->string('body')->nullable()->change();
        });
    }
};
