<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** M10: the front desk's package log. Two statuses, one delivery. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packages', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('unit_id');
            // Who it is addressed to; null means "the unit" (primary contact is notified).
            $table->foreignUlid('resident_id')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('pending');
            $table->foreignUlid('received_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('received_at');
            $table->foreignUlid('delivered_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('delivered_at')->nullable();
            $table->string('delivered_to')->nullable();
            // Where the arrival notice went; null when nobody had an email.
            $table->string('notified_email')->nullable();
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->foreign('unit_id')->references('id')->on('units')->restrictOnDelete();
            $table->foreign('resident_id')->references('id')->on('residents')->nullOnDelete();
            $table->index(['location_id', 'status', 'received_at']);
            $table->index(['unit_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packages');
    }
};
