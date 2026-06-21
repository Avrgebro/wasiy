<?php

namespace Database\Factories;

use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Models\Location;
use App\Models\RegistryImport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RegistryImport>
 */
class RegistryImportFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'location_id' => Location::factory(),
            'account_id' => fn (array $attributes): string => Location::query()->findOrFail($attributes['location_id'])->account_id,
            'requested_by_user_id' => User::factory(),
            'import_type' => ImportType::RegistryUnitsResidents,
            'status' => ImportStatus::Pending,
            'original_filename' => 'registro-importacion.csv',
            'disk' => config('wasiy.imports.disk', 'local'),
            'path' => null,
            'total_rows' => 0,
            'valid_rows' => 0,
            'error_rows' => 0,
            'duplicate_rows' => 0,
            'warning_rows' => 0,
        ];
    }
}
