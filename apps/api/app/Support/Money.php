<?php

namespace App\Support;

/**
 * Money travels as integer minor units (cents): 199.50 soles is 19950
 * everywhere in the database and the API. This is the one place that turns
 * minor units back into human copy for activity summaries and alerts.
 */
final class Money
{
    public static function soles(int $minor): string
    {
        return 'S/ '.number_format($minor / 100, 2, '.', ',');
    }
}
