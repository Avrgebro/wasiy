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
        Schema::create('reservations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('amenity_id');
            $table->foreignUlid('unit_id');
            $table->foreignUlid('resident_id')->nullable();
            // Stored UTC; every validation compares wall-clock times in the
            // Location's timezone.
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->string('status');
            // Required when the status is observed or rejected.
            $table->text('status_note')->nullable();
            // Copied from the Amenity at creation so later price edits do
            // not rewrite history. Whole soles, like the Amenity.
            $table->unsignedInteger('fee_snapshot')->nullable();
            $table->unsignedInteger('deposit_snapshot')->nullable();
            $table->foreignUlid('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignUlid('decided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['location_id', 'account_id'])
                ->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->foreign('amenity_id')->references('id')->on('amenities')->cascadeOnDelete();
            $table->foreign('unit_id')->references('id')->on('units')->restrictOnDelete();
            $table->foreign('resident_id')->references('id')->on('residents')->nullOnDelete();
            // Overlap queries for one amenity; day/list views for a location;
            // the approval queue for an account.
            $table->index(['amenity_id', 'starts_at']);
            $table->index(['location_id', 'starts_at']);
            $table->index(['account_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
