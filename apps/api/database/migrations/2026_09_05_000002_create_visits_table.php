<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** M12: the front desk's visit log. Walk-ins; pre-registration comes later. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('unit_id');
            // The host; null means "the unit".
            $table->foreignUlid('resident_id')->nullable();
            $table->string('visitor_name');
            // Text only — no ID images or copies (ADR 0024).
            $table->string('document')->nullable();
            $table->string('phone')->nullable();
            $table->string('confirmation')->default('none');
            $table->text('notes')->nullable();
            $table->string('status')->default('inside');
            $table->foreignUlid('checked_in_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('checked_in_at');
            $table->foreignUlid('checked_out_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('checked_out_at')->nullable();
            $table->text('checkout_notes')->nullable();
            $table->boolean('auto_checked_out')->default(false);
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->foreign('unit_id')->references('id')->on('units')->restrictOnDelete();
            $table->foreign('resident_id')->references('id')->on('residents')->nullOnDelete();
            $table->index(['location_id', 'status', 'checked_in_at']);
            $table->index(['unit_id', 'checked_in_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
