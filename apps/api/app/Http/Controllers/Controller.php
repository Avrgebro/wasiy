<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

abstract class Controller
{
    /**
     * Standard data envelope for composite payloads that don't map onto a
     * single Resource response.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function dataResponse(array $payload, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $payload], $status);
    }

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
