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
        Schema::create('amenities', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->string('name');
            $table->string('slug');
            $table->string('type');
            $table->text('description')->nullable();
            $table->boolean('is_reservable')->default(true);
            $table->unsignedInteger('capacity')->nullable();
            $table->string('booking_mode')->default('instant');
            $table->json('availability')->nullable();
            // Null booking-policy fields inherit from the Location's
            // operational settings through SettingsResolver.
            $table->unsignedInteger('max_duration_minutes')->nullable();
            $table->unsignedInteger('min_duration_minutes')->nullable();
            $table->unsignedInteger('buffer_minutes')->nullable();
            $table->unsignedInteger('max_advance_days')->nullable();
            $table->unsignedInteger('max_concurrent_per_unit')->nullable();
            $table->unsignedInteger('cancellation_window_hours')->nullable();
            // Whole soles, no decimals (mockup 06c); minor-unit refactors
            // wait for a multi-currency future.
            $table->unsignedInteger('fee_amount')->nullable();
            $table->unsignedInteger('deposit_amount')->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['location_id', 'account_id'])
                ->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->unique(['location_id', 'slug']);
            $table->index(['account_id', 'location_id', 'deactivated_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('amenities');
    }
};
