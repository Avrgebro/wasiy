<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A requested plan waits here until the team applies it at the renewal (ADR 0040). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->foreignUlid('requested_plan_id')->nullable()->after('plan_id')->constrained('plans')->nullOnDelete();
            $table->timestamp('plan_change_requested_at')->nullable()->after('requested_plan_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('requested_plan_id');
            $table->dropColumn('plan_change_requested_at');
        });
    }
};
