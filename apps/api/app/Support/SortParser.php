<?php

namespace App\Support;

use Closure;
use Illuminate\Database\Eloquent\Builder;

class SortParser
{
    /**
     * Apply a "field,-other" sort string against an allowlist. Each allowed
     * field maps to a column name or a Closure(Builder, string $direction)
     * for custom ordering. Unknown fields are ignored; a trailing id order
     * keeps pagination stable.
     *
     * @param  Builder<covariant \Illuminate\Database\Eloquent\Model>  $query
     * @param  array<string, string|Closure>  $fields
     */
    public static function apply(Builder $query, ?string $sort, array $fields, string $default): void
    {
        foreach (explode(',', $sort ?: $default) as $sortPart) {
            $sortPart = trim($sortPart);

            if ($sortPart === '') {
                continue;
            }

            $field = ltrim($sortPart, '-');
            $direction = str_starts_with($sortPart, '-') ? 'desc' : 'asc';
            $target = $fields[$field] ?? null;

            if ($target instanceof Closure) {
                $target($query, $direction);
            } elseif (is_string($target)) {
                $query->orderBy($target, $direction);
            }
        }

        $query->orderBy('id');
    }
}
