<?php

namespace App\Enums;

enum ImportRowStatus: string
{
    case Valid = 'valid';
    case Error = 'error';
    case Duplicate = 'duplicate';
    case Warning = 'warning';
    case Imported = 'imported';
    case Skipped = 'skipped';
}
