<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Portal P3: one alert row per recipient resident, so each person carries
 * their own read state. Rows are unit-scoped like the rest of the portal
 * and point at the reservation, package or visit they describe. Residents
 * choose which families also reach their inbox (`email_alerts`, null means
 * everything on).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resident_alerts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('location_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('unit_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('resident_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 40);
            $table->string('title');
            $table->string('body')->nullable();
            $table->string('subject_type', 40)->nullable();
            $table->ulid('subject_id')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['resident_id', 'unit_id', 'read_at']);
            $table->index('created_at');
        });

        Schema::table('residents', function (Blueprint $table) {
            $table->json('email_alerts')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('residents', function (Blueprint $table) {
            $table->dropColumn('email_alerts');
        });
        Schema::dropIfExists('resident_alerts');
    }
};
