<?php

namespace Database\Seeders;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\LocationType;
use App\Models\Account;
use App\Models\Location;
use App\Models\StaffLocationRole;
use App\Models\StaffMembership;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Demo accounts, locations, users, and staff memberships. Downstream demo
 * seeders look these up by slug/email.
 */
class DemoAccountsSeeder extends Seeder
{
    use WithoutModelEvents;

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
            'type' => LocationType::MultifamilyBuilding,
            'address_line1' => 'Av. Javier Prado Este 123',
            'district' => 'San Isidro',
            'city' => 'Lima',
        ]);

        $northTower = $this->location($account, 'torre-norte', [
            'name' => 'Torre Norte',
            'timezone' => 'America/Lima',
            'type' => LocationType::MultifamilyBuilding,
            'address_line1' => 'Av. Javier Prado Este 125',
            'district' => 'San Isidro',
            'city' => 'Lima',
        ]);

        $this->location($account, 'torre-sur', [
            'name' => 'Torre Sur',
            'timezone' => 'America/Lima',
            'type' => LocationType::MultifamilyBuilding,
            'address_line1' => 'Av. Javier Prado Este 127',
            'district' => 'San Isidro',
            'city' => 'Lima',
        ]);

        $this->location($account, 'residencial-pacifico', [
            'name' => 'Residencial Pacífico',
            'timezone' => 'America/Lima',
            'type' => LocationType::ResidentialCommunity,
            'address_line1' => 'Av. La Marina 980',
            'city' => 'Callao',
        ]);

        $this->location($account, 'condominio-valle', [
            'name' => 'Condominio Valle',
            'timezone' => 'America/Lima',
            'type' => LocationType::Condominium,
            'address_line1' => 'Av. El Sol 410',
            'district' => 'La Molina',
            'city' => 'Lima',
        ]);

        $this->location($account, 'parque-del-sol', [
            'name' => 'Parque del Sol',
            'timezone' => 'America/Lima',
            'type' => LocationType::ResidentialCommunity,
            'address_line1' => 'Calle Los Parques 245',
            'district' => 'San Isidro',
            'city' => 'Lima',
        ]);

        $this->location($account, 'jardines-de-miraflores', [
            'name' => 'Jardines de Miraflores',
            'timezone' => 'America/Lima',
            'type' => LocationType::ResidentialCommunity,
            'address_line1' => 'Av. Armendáriz 620',
            'district' => 'Miraflores',
            'city' => 'Lima',
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
            'type' => LocationType::MultifamilyBuilding,
            'address_line1' => 'Malecón de la Reserva 456',
            'district' => 'Miraflores',
            'city' => 'Lima',
        ]);

        // A lapsed customer: one location, one admin, so the lock screen and
        // the expired subscription state have demo data without locking any
        // other demo user out.
        $lapsedAccount = Account::query()->updateOrCreate(
            ['slug' => 'wasiy-andes'],
            [
                'name' => 'Wasiy Andes',
                'timezone' => 'America/Lima',
            ],
        );
        $this->location($lapsedAccount, 'residencial-andes', [
            'name' => 'Residencial Andes',
            'timezone' => 'America/Lima',
            'type' => LocationType::ResidentialCommunity,
            'address_line1' => 'Av. Los Incas 1450',
            'district' => 'Santiago de Surco',
            'city' => 'Lima',
        ]);

        $admin = $this->user('admin@wasiy.test', 'Alejandra', 'Admin');
        $manager = $this->user('manager@wasiy.test', 'Mariana', 'Rojas');
        $frontDesk = $this->user('frontdesk@wasiy.test', 'Felipe', 'Porteria');
        $multiAccountUser = $this->user('multi@wasiy.test', 'Mateo', 'Multi');
        $deactivated = $this->user('deactivated@wasiy.test', 'Diego', 'Salazar');
        $this->user('resident@wasiy.test', 'Rosa', 'Portal');
        $lapsedAdmin = $this->user('expired@wasiy.test', 'Elena', 'Quiroga');
        $this->membership($lapsedAccount, $lapsedAdmin, AccountRole::AccountAdmin);

        $this->membership($account, $admin, AccountRole::AccountAdmin);
        $this->locationRole($this->membership($account, $manager), $location, LocationRole::LocationManager);
        $this->locationRole($this->membership($account, $frontDesk), $northTower, LocationRole::FrontDesk);

        $multiDemoMembership = $this->membership($account, $multiAccountUser);
        $this->locationRole($multiDemoMembership, $location, LocationRole::LocationManager);
        $this->locationRole($this->membership($secondAccount, $multiAccountUser), $beachLocation, LocationRole::FrontDesk);

        // Suspended in wasiy-demo only: keeps the staff table's dimmed
        // "Desactivado" state reachable with demo data. The role row stays so
        // the record remains listed; the User can still log in.
        $deactivatedMembership = $this->membership($account, $deactivated);
        $this->locationRole($deactivatedMembership, $northTower, LocationRole::FrontDesk);
        $deactivatedMembership->forceFill([
            'deactivated_at' => $deactivatedMembership->deactivated_at ?? now(),
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $attributes
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

    private function membership(Account $account, User $user, ?AccountRole $accountRole = null): StaffMembership
    {
        return StaffMembership::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'user_id' => $user->id,
            ],
            ['account_role' => $accountRole],
        );
    }

    private function locationRole(StaffMembership $membership, Location $location, LocationRole $role): void
    {
        StaffLocationRole::query()->updateOrCreate(
            [
                'staff_membership_id' => $membership->id,
                'location_id' => $location->id,
            ],
            [
                'account_id' => $membership->account_id,
                'role' => $role,
            ],
        );
    }
}
