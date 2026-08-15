<?php

namespace App\Data\RegistryImports;

use App\Enums\ImportRowStatus;

class RegistryImportRowPreview
{
    /**
     * @param  array<string, string|null>  $rawData
     * @param  array<int, string>  $errors
     * @param  array<int, string>  $warnings
     */
    public function __construct(
        public readonly int $rowNumber,
        public readonly array $rawData,
        public NormalizedRegistryRow $normalizedData,
        public ImportRowStatus $status = ImportRowStatus::Valid,
        public array $errors = [],
        public array $warnings = [],
        public ?string $duplicateKey = null,
    ) {}

    public function addError(string $message): void
    {
        $this->errors[] = $message;
        $this->status = ImportRowStatus::Error;
    }

    public function addWarning(string $message): void
    {
        if (! in_array($message, $this->warnings, true)) {
            $this->warnings[] = $message;
        }

        if ($this->status === ImportRowStatus::Valid) {
            $this->status = ImportRowStatus::Warning;
        }
    }

    public function markDuplicate(string $duplicateKey): void
    {
        $this->duplicateKey = $duplicateKey;
        $this->status = ImportRowStatus::Duplicate;
    }
}
