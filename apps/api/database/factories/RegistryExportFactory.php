<?php

namespace Database\Factories;

use App\Enums\ExportStatus;
use App\Enums\ExportType;
use App\Models\Account;
use App\Models\RegistryExport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RegistryExport>
 */
class RegistryExportFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'account_id' => Account::factory(),
            'location_id' => null,
            'requested_by_user_id' => User::factory(),
            'export_type' => ExportType::RegistryUnitsResidents,
            'filters' => [],
            'status' => ExportStatus::Pending,
            'disk' => config('wasiy.exports.disk', 'local'),
            'path' => null,
            'filename' => 'registro-'.now()->format('Ymd-His').'.csv',
            'expires_at' => now()->addDays((int) config('wasiy.exports.expires_days', 7)),
        ];
    }
}
