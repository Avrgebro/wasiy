<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUlid('plan_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('trialing');
            $table->unsignedInteger('unit_price_minor');
            $table->unsignedInteger('billable_units');
            $table->string('currency', 3)->default('PEN');
            $table->timestamp('trial_starts_at');
            $table->timestamp('trial_ends_at');
            $table->timestamp('access_until');
            $table->timestamp('terms_accepted_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
