<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staff membership as a first-class entity (ADR 0033). Replaces the derived
 * union of account_user_roles + location_user_roles. account_user_roles was
 * unique per (account, user), so the account role collapses into a nullable
 * column on the membership. No backfill: demo data is reseeded.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_memberships', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('user_id')->constrained()->restrictOnDelete();
            $table->string('account_role')->nullable();
            $table->timestamp('deactivated_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['account_id', 'user_id']);
            // Composite target so staff_location_roles can prove its rows
            // share the membership's account.
            $table->unique(['id', 'account_id']);
            $table->index(['user_id', 'account_id']);
        });

        Schema::create('staff_location_roles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('staff_membership_id');
            $table->foreignUlid('account_id');
            $table->foreignUlid('location_id');
            $table->string('role');
            $table->timestamps();

            $table->foreign(['staff_membership_id', 'account_id'])
                ->references(['id', 'account_id'])
                ->on('staff_memberships')
                ->cascadeOnDelete();
            $table->foreign(['location_id', 'account_id'])
                ->references(['id', 'account_id'])
                ->on('locations')
                ->cascadeOnDelete();
            $table->unique(['staff_membership_id', 'location_id']);
            $table->index(['account_id', 'location_id']);
        });

        Schema::dropIfExists('location_user_roles');
        Schema::dropIfExists('account_user_roles');
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_location_roles');
        Schema::dropIfExists('staff_memberships');

        // The original role tables are not recreated on rollback; roll back
        // to 0001_01_01_000003 to restore them.
    }
};
