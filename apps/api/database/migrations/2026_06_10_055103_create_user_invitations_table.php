<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_invitations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('token_hash')->unique();
            $table->string('purpose');
            $table->string('status');
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->foreignUlid('invited_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['account_id', 'email', 'purpose', 'status']);
            $table->index(['account_id', 'status', 'expires_at']);
            $table->index(['user_id', 'account_id']);
        });

        DB::statement(
            "CREATE UNIQUE INDEX user_invitations_pending_unique ON user_invitations (account_id, email, purpose) WHERE status = 'pending'",
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS user_invitations_pending_unique');

        Schema::dropIfExists('user_invitations');
    }
};
