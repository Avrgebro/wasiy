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
        Schema::create('financial_movements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            // income | expense carries the sign; amount is always positive.
            $table->string('direction');
            $table->string('category');
            $table->string('status');
            // Whole soles, like amenities and reservations (ADR 0034).
            $table->unsignedInteger('amount');
            $table->string('concept', 120);
            $table->string('detail')->nullable();
            // Vendor or payer when there is no unit behind the movement.
            $table->string('counterparty', 120)->nullable();
            $table->foreignUlid('unit_id')->nullable();
            // Set only by the reservations module; one row per category.
            $table->foreignUlid('reservation_id')->nullable();
            // Ledger dates are wall-clock in the Location's timezone.
            $table->date('occurred_on');
            $table->date('due_on')->nullable();
            $table->text('note')->nullable();
            $table->foreignUlid('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignUlid('settled_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['location_id', 'account_id'])
                ->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->foreign('unit_id')->references('id')->on('units')->restrictOnDelete();
            $table->foreign('reservation_id')->references('id')->on('reservations')->nullOnDelete();
            // The month list; outstanding balances; idempotent generation.
            $table->index(['location_id', 'occurred_on']);
            $table->index(['account_id', 'status']);
            $table->unique(['reservation_id', 'category']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_movements');
    }
};
