<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every money column outside the invoices tables moves to integer minor
 * units (cents) with a `_minor` suffix, matching invoices.amount_minor.
 * Existing rows held whole soles, so their values are multiplied by 100.
 */
return new class extends Migration
{
    /** @var array<string, array<string, string>> table => [old => new] */
    private const COLUMNS = [
        'amenities' => ['fee_amount' => 'fee_amount_minor', 'deposit_amount' => 'deposit_amount_minor'],
        'reservations' => ['fee_snapshot' => 'fee_snapshot_minor', 'deposit_snapshot' => 'deposit_snapshot_minor'],
        'financial_movements' => ['amount' => 'amount_minor'],
        'units' => ['maintenance_fee' => 'maintenance_fee_minor'],
    ];

    public function up(): void
    {
        foreach (self::COLUMNS as $table => $columns) {
            Schema::table($table, function (Blueprint $blueprint) use ($columns): void {
                foreach ($columns as $old => $new) {
                    $blueprint->renameColumn($old, $new);
                }
            });

            foreach ($columns as $new) {
                DB::table($table)->update([$new => DB::raw("{$new} * 100")]);
            }
        }

        // Monthly sums of a whole building's ledger in cents can pass 2^31.
        Schema::table('financial_movements', function (Blueprint $blueprint): void {
            $blueprint->unsignedBigInteger('amount_minor')->change();
        });
    }

    public function down(): void
    {
        Schema::table('financial_movements', function (Blueprint $blueprint): void {
            $blueprint->unsignedInteger('amount_minor')->change();
        });

        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $new) {
                DB::table($table)->update([$new => DB::raw("{$new} / 100")]);
            }

            Schema::table($table, function (Blueprint $blueprint) use ($columns): void {
                foreach ($columns as $old => $new) {
                    $blueprint->renameColumn($new, $old);
                }
            });
        }
    }
};
