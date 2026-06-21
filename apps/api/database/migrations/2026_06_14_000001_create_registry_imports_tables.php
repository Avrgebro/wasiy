<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registry_imports', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('requested_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('import_type');
            $table->string('status')->default('pending');
            $table->string('original_filename');
            $table->string('disk')->nullable();
            $table->string('path')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('valid_rows')->default(0);
            $table->unsignedInteger('error_rows')->default(0);
            $table->unsignedInteger('duplicate_rows')->default(0);
            $table->unsignedInteger('warning_rows')->default(0);
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->restrictOnDelete();
            $table->unique(['id', 'account_id', 'location_id']);
            $table->index(['account_id', 'location_id', 'status']);
            $table->index(['account_id', 'requested_by_user_id', 'created_at']);
        });

        Schema::create('registry_import_rows', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('registry_import_id');
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->unsignedInteger('row_number');
            $table->string('status')->default('valid');
            $table->json('raw_data');
            $table->json('normalized_data');
            $table->json('errors');
            $table->json('warnings');
            $table->string('duplicate_key')->nullable();
            $table->ulid('committed_unit_id')->nullable();
            $table->ulid('committed_resident_id')->nullable();
            $table->ulid('committed_unit_membership_id')->nullable();
            $table->timestamps();

            $table->foreign(['registry_import_id', 'account_id', 'location_id'])->references(['id', 'account_id', 'location_id'])->on('registry_imports')->cascadeOnDelete();
            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->restrictOnDelete();
            $table->unique(['registry_import_id', 'row_number']);
            $table->index(['registry_import_id', 'status', 'row_number']);
            $table->index(['account_id', 'location_id', 'status']);
            $table->index('duplicate_key');
            $table->index('committed_unit_id');
            $table->index('committed_resident_id');
            $table->index('committed_unit_membership_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registry_import_rows');
        Schema::dropIfExists('registry_imports');
    }
};
