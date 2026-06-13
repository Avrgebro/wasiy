<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exports', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id')->nullable();
            $table->foreignUlid('requested_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('export_type');
            $table->json('filters');
            $table->string('status')->default('pending');
            $table->string('disk')->nullable();
            $table->string('path')->nullable();
            $table->string('filename');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->restrictOnDelete();
            $table->index(['account_id', 'location_id', 'status']);
            $table->index(['account_id', 'requested_by_user_id', 'created_at']);
            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exports');
    }
};
