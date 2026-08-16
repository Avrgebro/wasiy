<?php

namespace App\Rules;

use App\Models\Unit;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates that the value identifies a Unit the caller may assign to,
 * per the given predicate. The single owner of the "selected unit is not
 * available" family of checks.
 */
class AssignableUnit implements ValidationRule
{
    /**
     * @param  Closure(Unit): bool  $assignable
     */
    public function __construct(
        private readonly Closure $assignable,
        private readonly string $message,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $unit = is_string($value) ? Unit::query()->find($value) : null;

        if (! $unit || ! ($this->assignable)($unit)) {
            $fail($this->message);
        }
    }
}
