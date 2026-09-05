<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Categories v2 (mockup 10): the flat six-value set becomes a closed,
 * direction-scoped list. Pre-production data is remapped in place.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('financial_movements')->where('category', 'utility')
            ->whereRaw("LOWER(concept) LIKE '%agua%'")->update(['category' => 'water']);
        DB::table('financial_movements')->where('category', 'utility')
            ->whereRaw("LOWER(concept) LIKE '%luz%' OR LOWER(concept) LIKE '%electric%'")->update(['category' => 'electricity']);
        DB::table('financial_movements')->where('category', 'utility')->update(['category' => 'other_expense']);
        DB::table('financial_movements')->where('category', 'other')->where('direction', 'income')->update(['category' => 'other_income']);
        DB::table('financial_movements')->where('category', 'other')->update(['category' => 'other_expense']);
    }

    public function down(): void
    {
        DB::table('financial_movements')->whereIn('category', ['water', 'electricity', 'gas', 'telecom'])->update(['category' => 'utility']);
        DB::table('financial_movements')->whereIn('category', ['security', 'staff', 'supplies', 'gardening', 'insurance_taxes', 'administration', 'other_expense', 'maintenance_dues', 'fine', 'other_income'])->update(['category' => 'other']);
    }
};
