<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->string('name');
            $table->unsignedInteger('unit_price_minor');
            $table->string('currency', 3)->default('PEN');
            $table->unsignedInteger('location_limit')->default(1);
            // The base price covers this many units; subscriptions bill
            // max(units, included_units) at unit_price_minor each.
            $table->unsignedInteger('included_units')->default(1);
            $table->json('features');
            $table->boolean('is_available')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
