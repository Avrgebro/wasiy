<?php

namespace App\Data;

use Illuminate\Contracts\Support\Arrayable;
use InvalidArgumentException;
use JsonSerializable;

/**
 * Per-weekday open windows for an Amenity. Shape:
 *
 *   {"monday": [{"start": "09:00", "end": "22:00"}], ...}
 *
 * A weekday absent or holding an empty list is closed. Windows within a day
 * must not overlap and must close after they open — the single owner of
 * those rules for the API, the reservations milestone, and the seeder.
 *
 * @implements Arrayable<string, array<int, array{start: string, end: string}>>
 */
class AmenityAvailability implements Arrayable, JsonSerializable
{
    public const WEEKDAYS = [
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ];

    /**
     * @param  array<string, array<int, array{start: string, end: string}>>  $windows
     */
    private function __construct(
        private readonly array $windows,
    ) {}

    /**
     * @param  array<string, mixed>  $raw
     */
    public static function fromArray(array $raw): self
    {
        $windows = [];

        foreach ($raw as $day => $dayWindows) {
            if (! in_array($day, self::WEEKDAYS, true)) {
                throw new InvalidArgumentException("Unknown weekday [{$day}].");
            }

            if (! is_array($dayWindows)) {
                throw new InvalidArgumentException("Windows for [{$day}] must be a list.");
            }

            $normalized = array_map(
                fn (mixed $window): array => self::normalizeWindow($day, $window),
                array_values($dayWindows),
            );

            usort($normalized, fn (array $a, array $b): int => strcmp($a['start'], $b['start']));

            foreach ($normalized as $index => $window) {
                if ($index > 0 && $window['start'] < $normalized[$index - 1]['end']) {
                    throw new InvalidArgumentException(
                        "Windows for [{$day}] overlap between {$window['start']} and {$normalized[$index - 1]['end']}.",
                    );
                }
            }

            if ($normalized !== []) {
                $windows[$day] = $normalized;
            }
        }

        return new self($windows);
    }

    public static function alwaysClosed(): self
    {
        return new self([]);
    }

    /**
     * @return array<int, array{start: string, end: string}>
     */
    public function windowsFor(string $weekday): array
    {
        return $this->windows[$weekday] ?? [];
    }

    public function isOpenOn(string $weekday): bool
    {
        return $this->windowsFor($weekday) !== [];
    }

    /**
     * @return array<string, array<int, array{start: string, end: string}>>
     */
    public function toArray(): array
    {
        return $this->windows;
    }

    /**
     * @return array<string, array<int, array{start: string, end: string}>>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * @return array{start: string, end: string}
     */
    private static function normalizeWindow(string $day, mixed $window): array
    {
        if (! is_array($window) || ! is_string($window['start'] ?? null) || ! is_string($window['end'] ?? null)) {
            throw new InvalidArgumentException("Each window for [{$day}] needs start and end times.");
        }

        $pattern = '/^([01]\d|2[0-3]):[0-5]\d$/';

        if (preg_match($pattern, $window['start']) !== 1 || preg_match($pattern, $window['end']) !== 1) {
            throw new InvalidArgumentException("Times for [{$day}] must be HH:MM.");
        }

        if ($window['end'] <= $window['start']) {
            throw new InvalidArgumentException("A window for [{$day}] closes before it opens.");
        }

        return ['start' => $window['start'], 'end' => $window['end']];
    }
}
