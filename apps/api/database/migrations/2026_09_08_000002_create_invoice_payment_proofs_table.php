<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the customer uploads to show a manual payment (ADR 0040). Several per
 * invoice are allowed; the latest is the one under review. Files live on a
 * private disk and are streamed through the API, never linked directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_payment_proofs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('disk', 40);
            $table->string('path');
            $table->string('original_filename');
            $table->string('mime_type', 100);
            $table->unsignedInteger('size_bytes');
            $table->date('paid_on')->nullable();
            $table->unsignedInteger('amount_minor')->nullable();
            $table->string('operation_number', 60)->nullable();
            $table->timestamps();

            $table->index(['invoice_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_payment_proofs');
    }
};
