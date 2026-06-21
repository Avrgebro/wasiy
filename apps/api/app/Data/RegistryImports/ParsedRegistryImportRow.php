<?php

namespace App\Data\RegistryImports;

class ParsedRegistryImportRow
{
    /**
     * @param  array<string, string|null>  $rawData
     * @param  array<string, mixed>  $normalizedData
     */
    public function __construct(
        public readonly int $rowNumber,
        public readonly array $rawData,
        public readonly array $normalizedData,
    ) {}
}
