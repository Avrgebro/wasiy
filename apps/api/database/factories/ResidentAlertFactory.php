<?php

namespace Database\Factories;

use App\Enums\ResidentAlertKind;
use App\Models\Account;
use App\Models\Location;
use App\Models\Resident;
use App\Models\ResidentAlert;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ResidentAlert> */
class ResidentAlertFactory extends Factory
{
    protected $model = ResidentAlert::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'account_id' => Account::factory(),
            'location_id' => Location::factory(),
            'unit_id' => Unit::factory(),
            'resident_id' => Resident::factory(),
            'kind' => ResidentAlertKind::PackageReceived,
            'title' => 'Paquete recibido',
            'body' => 'Recepción tiene un paquete para tu unidad.',
            'subject_type' => null,
            'subject_id' => null,
            'read_at' => null,
        ];
    }

    public function read(): static
    {
        return $this->state(fn () => ['read_at' => now()]);
    }
}
