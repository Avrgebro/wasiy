<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            ['code' => 'esencial', 'name' => 'Esencial', 'unit_price_minor' => 450, 'features' => ['Registro de visitantes', 'Unidades y residentes', 'Anuncios', 'Portal del residente']],
            ['code' => 'operativo', 'name' => 'Operativo', 'unit_price_minor' => 650, 'features' => ['Todo lo de Esencial', 'Reservas con aprobación y cuotas', 'Vehículos', 'Registro de actividad', 'Exportaciones CSV']],
        ] as $plan) {
            Plan::query()->firstOrCreate(['code' => $plan['code']], [...$plan, 'currency' => 'PEN', 'location_limit' => 1, 'included_units' => 10, 'is_available' => true]);
        }
    }
}
