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
        Schema::create('accounts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('timezone')->default('America/Lima');
            $table->timestamps();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('timezone')->default('America/Lima');
            $table->string('address')->nullable();
            $table->timestamps();

            $table->unique(['account_id', 'slug']);
            $table->unique(['id', 'account_id']);
            $table->index(['account_id', 'name']);
        });

        Schema::create('account_user_roles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('role');
            $table->timestamps();

            $table->unique(['account_id', 'user_id', 'role']);
            $table->index(['user_id', 'account_id']);
        });

        Schema::create('location_user_roles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('role');
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->unique(['location_id', 'user_id', 'role']);
            $table->index(['account_id', 'user_id']);
            $table->index(['user_id', 'location_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('location_user_roles');
        Schema::dropIfExists('account_user_roles');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('accounts');
    }
};
