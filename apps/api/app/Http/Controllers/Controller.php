<?php

namespace App\Http\Controllers;

abstract class Controller
{
    /**
     * Shared pagination validation for list endpoints; per-page is capped
     * at 100 in exactly one place.
     *
     * @return array<string, array<int, string>>
     */
    protected function paginationRules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    protected function perPage(array $validated): int
    {
        return (int) ($validated['per_page'] ?? 15);
    }
}
