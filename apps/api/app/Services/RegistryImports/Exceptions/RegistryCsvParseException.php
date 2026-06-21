<?php

namespace App\Services\RegistryImports\Exceptions;

use RuntimeException;

class RegistryCsvParseException extends RuntimeException
{
    /**
     * @param  array<int, string>  $errors
     */
    public function __construct(
        public readonly array $errors,
    ) {
        parent::__construct($errors[0] ?? 'El CSV no pudo ser procesado.');
    }
}
