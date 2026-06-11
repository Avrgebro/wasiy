<?php

namespace Database\Seeders;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\AccountUserRole;
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

        $location = $this->location($account, 'edificio-central', [
            'name' => 'Edificio Central',
            'timezone' => 'America/Lima',
            'address' => 'Av. Javier Prado Este 123, Lima',
        ]);

        $northTower = $this->location($account, 'torre-norte', [
            'name' => 'Torre Norte',
            'timezone' => 'America/Lima',
            'address' => 'Av. Javier Prado Este 125, Lima',
        ]);

        $secondAccount = Account::query()->updateOrCreate(
            ['slug' => 'wasiy-playa'],
            [
                'name' => 'Wasiy Playa',
                'timezone' => 'America/Lima',
            ],
        );

        $beachLocation = $this->location($secondAccount, 'edificio-playa', [
            'name' => 'Edificio Playa',
            'timezone' => 'America/Lima',
            'address' => 'Malecón de la Reserva 456, Lima',
        ]);

        $admin = $this->user('admin@wasiy.test', 'Alejandra', 'Admin');
        $manager = $this->user('manager@wasiy.test', 'Mariana', 'Rojas');
        $frontDesk = $this->user('frontdesk@wasiy.test', 'Felipe', 'Porteria');
        $multiAccountUser = $this->user('multi@wasiy.test', 'Mateo', 'Multi');

        $this->accountRole($account, $admin, AccountRole::AccountAdmin);
        $this->locationRole($account, $location, $manager, LocationRole::LocationManager);
        $this->locationRole($account, $northTower, $frontDesk, LocationRole::FrontDesk);
        $this->locationRole($account, $location, $multiAccountUser, LocationRole::LocationManager);
        $this->locationRole($secondAccount, $beachLocation, $multiAccountUser, LocationRole::FrontDesk);
    }

    /**
     * @param  array{name: string, timezone: string, address: string}  $attributes
     */
    private function location(Account $account, string $slug, array $attributes): Location
    {
        return Location::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'slug' => $slug,
            ],
            $attributes,
        );
    }

    private function user(string $email, string $firstName, string $lastName): User
    {
        return User::query()->updateOrCreate(
            ['email' => $email],
            [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email_verified_at' => now(),
                'password' => 'password',
            ],
        );
    }

    private function accountRole(Account $account, User $user, AccountRole $role): void
    {
        AccountUserRole::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'user_id' => $user->id,
            ],
            ['role' => $role],
        );
    }

    private function locationRole(Account $account, Location $location, User $user, LocationRole $role): void
    {
        LocationUserRole::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'location_id' => $location->id,
                'user_id' => $user->id,
            ],
            ['role' => $role],
        );
    }
}
