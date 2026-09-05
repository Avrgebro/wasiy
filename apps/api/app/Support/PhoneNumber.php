<?php

namespace App\Support;

use Propaganistas\LaravelPhone\Exceptions\NumberParseException;
use Propaganistas\LaravelPhone\Rules\Phone;

/**
 * Phones are stored in E.164 ("+51987654321") everywhere, so tap-to-call,
 * digit search and a second country all work on one format. The desk types
 * the national number; the Location's country supplies the prefix.
 */
final class PhoneNumber
{
    public const FALLBACK_COUNTRY = 'PE';

    /**
     * Validation for a phone field: blank allowed, otherwise a real number
     * for the given country or any number written with its + prefix.
     *
     * @return list<mixed>
     */
    public static function rules(string $country): array
    {
        return ['nullable', 'string', 'max:32', (new Phone)->country([self::country($country)])->international()];
    }

    /** E.164 for anything that passed rules(); null for blank. */
    public static function normalize(?string $raw, string $country): ?string
    {
        $raw = is_string($raw) ? trim($raw) : '';
        if ($raw === '') {
            return null;
        }

        return phone($raw, self::country($country))->formatE164();
    }

    /** Best effort for legacy data and imports: E.164 when parseable, the raw text otherwise. */
    public static function normalizeLenient(?string $raw, string $country): ?string
    {
        try {
            return self::normalize($raw, $country);
        } catch (NumberParseException) {
            return is_string($raw) && trim($raw) !== '' ? trim($raw) : null;
        }
    }

    /** Digits only, for matching a typed term against stored E.164 values. */
    public static function digits(string $term): string
    {
        return preg_replace('/\D+/', '', $term) ?? '';
    }

    private static function country(?string $country): string
    {
        return strtoupper($country ?: self::FALLBACK_COUNTRY);
    }
}
