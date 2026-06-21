<?php

namespace Database\Factories;

use App\Enums\ImportRowStatus;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RegistryImportRow>
 */
class RegistryImportRowFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'registry_import_id' => RegistryImport::factory(),
            'account_id' => fn (array $attributes): string => RegistryImport::query()->findOrFail($attributes['registry_import_id'])->account_id,
            'location_id' => fn (array $attributes): string => RegistryImport::query()->findOrFail($attributes['registry_import_id'])->location_id,
            'row_number' => fake()->numberBetween(1, 5000),
            'status' => ImportRowStatus::Valid,
            'raw_data' => [],
            'normalized_data' => [],
            'errors' => [],
            'warnings' => [],
            'duplicate_key' => null,
            'committed_unit_id' => null,
            'committed_resident_id' => null,
            'committed_unit_membership_id' => null,
        ];
    }
}
