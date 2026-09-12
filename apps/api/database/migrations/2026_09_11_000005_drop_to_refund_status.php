<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * ADR 0034 revision: the deposit machine loses `to_refund`. A deposit
     * flagged for refund is still money in hand, so it goes back to `held`;
     * the activity log keeps the flag.
     */
    public function up(): void
    {
        DB::table('financial_movements')->where('status', 'to_refund')->update(['status' => 'held']);
    }

    public function down(): void
    {
        // Nothing to restore: which held deposits had been flagged is only in the activity log.
    }
};
