<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A pre-registration is a visit in status `expected` (portal P1): the
 * resident announces it, the desk confirms the arrival (→ inside) or the
 * resident cancels it (→ cancelled). Check-in columns become nullable
 * because an expected visit has not checked in yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->foreignUlid('checked_in_by')->nullable()->change();
            $table->timestamp('checked_in_at')->nullable()->change();
            $table->date('expected_on')->nullable()->after('status');
            // Wall-clock time in the location's timezone; null means "sin hora".
            $table->time('expected_time')->nullable()->after('expected_on');
            $table->foreignUlid('pre_registered_by')->nullable()->after('expected_time')->constrained('residents')->nullOnDelete();
            $table->timestamp('pre_registered_at')->nullable()->after('pre_registered_by');
            $table->timestamp('cancelled_at')->nullable()->after('checkout_notes');

            $table->index(['unit_id', 'status', 'expected_on']);
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->dropIndex(['unit_id', 'status', 'expected_on']);
            $table->dropConstrainedForeignId('pre_registered_by');
            $table->dropColumn(['expected_on', 'expected_time', 'pre_registered_at', 'cancelled_at']);
        });
    }
};
