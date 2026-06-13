<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->string('unit_number');
            $table->string('building_name')->nullable();
            $table->string('floor')->nullable();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->restrictOnDelete();
            $table->unique(['id', 'account_id']);
            $table->unique(['id', 'account_id', 'location_id']);
            $table->index(['account_id', 'location_id', 'status']);
        });

        Schema::create('residents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->unique(['id', 'account_id']);
            $table->index(['account_id', 'last_name', 'first_name']);
            $table->index(['account_id', 'status']);
        });

        Schema::create('unit_memberships', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('unit_id');
            $table->foreignUlid('resident_id');
            $table->string('resident_type');
            $table->string('status')->default('active');
            $table->boolean('is_primary_contact')->default(false);
            $table->date('started_at')->nullable();
            $table->date('ended_at')->nullable();
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->restrictOnDelete();
            $table->foreign(['unit_id', 'account_id', 'location_id'])->references(['id', 'account_id', 'location_id'])->on('units')->restrictOnDelete();
            $table->foreign(['resident_id', 'account_id'])->references(['id', 'account_id'])->on('residents')->restrictOnDelete();
            $table->index(['account_id', 'location_id', 'unit_id', 'status']);
            $table->index(['account_id', 'resident_id', 'status']);
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('unit_id');
            $table->string('vehicle_type');
            $table->string('plate')->nullable();
            $table->string('make')->nullable();
            $table->string('model')->nullable();
            $table->string('color')->nullable();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->restrictOnDelete();
            $table->foreign(['unit_id', 'account_id', 'location_id'])->references(['id', 'account_id', 'location_id'])->on('units')->restrictOnDelete();
            $table->index(['account_id', 'location_id', 'unit_id', 'status']);
            $table->index(['account_id', 'location_id', 'plate']);
        });

        DB::statement("CREATE UNIQUE INDEX units_location_unit_number_building_unique ON units (location_id, unit_number, COALESCE(building_name, ''))");
        DB::statement('CREATE UNIQUE INDEX residents_user_id_unique_when_present ON residents (user_id) WHERE user_id IS NOT NULL');
        DB::statement("CREATE UNIQUE INDEX unit_memberships_one_active_primary_contact_per_unit ON unit_memberships (unit_id) WHERE status = 'active' AND is_primary_contact");
        DB::statement("ALTER TABLE unit_memberships ADD CONSTRAINT unit_memberships_primary_contact_active_check CHECK (is_primary_contact = false OR status = 'active')");
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('unit_memberships');
        Schema::dropIfExists('residents');
        Schema::dropIfExists('units');
    }
};
