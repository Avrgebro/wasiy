<?php

namespace App\Support;

/**
 * The timezone a Location runs on, derived from its country. Nobody is asked:
 * every country Wasiy sells in today has one zone and no daylight saving.
 * When a country with several zones lands (Mexico, Brazil), that country
 * gets a picker and this map keeps answering for the rest.
 */
final class Timezones
{
    public const DEFAULT = 'America/Lima';

    private const BY_COUNTRY = [
        'PE' => 'America/Lima',
        'CO' => 'America/Bogota',
        'EC' => 'America/Guayaquil',
        'CL' => 'America/Santiago',
        'BO' => 'America/La_Paz',
        'PA' => 'America/Panama',
        'AR' => 'America/Argentina/Buenos_Aires',
    ];

    public static function forCountry(?string $country): string
    {
        return self::BY_COUNTRY[strtoupper((string) $country)] ?? self::DEFAULT;
    }
}
