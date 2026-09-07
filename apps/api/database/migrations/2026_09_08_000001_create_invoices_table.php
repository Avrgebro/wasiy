<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per billing period of a Subscription (ADR 0040). Units and price
 * are frozen at issue so a later plan or unit change never rewrites what
 * was owed. Numbers are global and gapless per year (F-2026-0042), counted
 * in invoice_sequences under a row lock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last_number')->default(0);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('subscription_id')->constrained()->restrictOnDelete();
            $table->string('number', 20)->unique();
            $table->date('period_starts_on');
            $table->date('period_ends_on');
            $table->unsignedInteger('billable_units');
            $table->unsignedInteger('unit_price_minor');
            $table->unsignedInteger('amount_minor');
            $table->string('currency', 3)->default('PEN');
            $table->string('status', 20)->default('pending');
            $table->date('due_on');
            $table->timestamp('issued_at');
            $table->timestamp('paid_at')->nullable();
            $table->string('payment_method', 20)->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['subscription_id', 'status']);
            $table->index(['account_id', 'issued_at']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            // A scheduled decrease: applies at the next renewal (ADR 0040).
            $table->unsignedInteger('pending_billable_units')->nullable()->after('billable_units');
            $table->date('pending_units_from')->nullable()->after('pending_billable_units');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn(['pending_billable_units', 'pending_units_from']);
        });
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('invoice_sequences');
    }
};
