<?php

namespace Database\Seeders;

use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $account = Account::query()->updateOrCreate(
            ['slug' => 'wasiy-demo'],
            [
                'name' => 'Wasiy Demo',
                'timezone' => 'America/Lima',
            ],
        );

        $location = Location::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'slug' => 'edificio-central',
            ],
            [
                'name' => 'Edificio Central',
                'timezone' => 'America/Lima',
                'address' => 'Av. Javier Prado Este 123, Lima',
            ],
        );

        $manager = User::query()->updateOrCreate(
            ['email' => 'manager@wasiy.test'],
            [
                'first_name' => 'Mariana',
                'last_name' => 'Rojas',
                'email_verified_at' => now(),
                'password' => 'password',
            ],
        );

        LocationUserRole::query()->firstOrCreate([
            'account_id' => $account->id,
            'location_id' => $location->id,
            'user_id' => $manager->id,
            'role' => LocationRole::LocationManager,
        ]);
    }
}
