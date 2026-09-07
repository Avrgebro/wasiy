<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * F-2026-0042: global, gapless per year. The sequences row is locked for
 * the duration of the caller's transaction, so two invoices issued in the
 * same second cannot share a number.
 */
final class InvoiceNumber
{
    public static function next(int $year): string
    {
        DB::table('invoice_sequences')->insertOrIgnore(['year' => $year, 'last_number' => 0]);
        $row = DB::table('invoice_sequences')->where('year', $year)->lockForUpdate()->first();
        $number = (int) $row->last_number + 1;
        DB::table('invoice_sequences')->where('year', $year)->update(['last_number' => $number]);

        return sprintf('F-%d-%04d', $year, $number);
    }
}
