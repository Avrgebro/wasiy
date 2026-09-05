<?php

namespace Database\Factories;

use App\Enums\PackageStatus;
use App\Models\Package;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Package> */
class PackageFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $unit = Unit::factory()->create();

        return [
            'account_id' => $unit->account_id,
            'location_id' => $unit->location_id,
            'unit_id' => $unit->id,
            'resident_id' => null,
            'notes' => 'Caja mediana',
            'status' => PackageStatus::Pending,
            'received_by' => User::factory(),
            'received_at' => now(),
        ];
    }
}
