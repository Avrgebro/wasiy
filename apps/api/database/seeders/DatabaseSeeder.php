<?php

namespace Database\Seeders;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Enums\VehicleType;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\UserInvitation;
use App\Models\Vehicle;
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

        $this->seedRegistryScenarios($account, $location, $northTower, $manager);
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

    private function seedRegistryScenarios(Account $account, Location $centralLocation, Location $northTower, User $manager): void
    {
        $central101 = $this->unit($account, $centralLocation, '101', [
            'building_name' => 'Torre A',
            'floor' => '1',
            'status' => RegistryStatus::Active,
            'notes' => 'Unidad demo con contacto principal.',
        ]);
        $central102 = $this->unit($account, $centralLocation, '102', [
            'building_name' => 'Torre A',
            'floor' => '1',
            'status' => RegistryStatus::Active,
            'notes' => null,
        ]);
        $central201 = $this->unit($account, $centralLocation, '201', [
            'building_name' => 'Torre B',
            'floor' => '2',
            'status' => RegistryStatus::Active,
            'notes' => 'Unidad con invitacion pendiente.',
        ]);
        $this->unit($account, $centralLocation, '301', [
            'building_name' => 'Torre B',
            'floor' => '3',
            'status' => RegistryStatus::Inactive,
            'notes' => 'Unidad inactiva para validacion manual.',
        ]);

        $north501 = $this->unit($account, $northTower, '501', [
            'building_name' => 'Torre Norte',
            'floor' => '5',
            'status' => RegistryStatus::Active,
            'notes' => null,
        ]);
        $north502 = $this->unit($account, $northTower, '502', [
            'building_name' => 'Torre Norte',
            'floor' => '5',
            'status' => RegistryStatus::Active,
            'notes' => null,
        ]);

        $portalUser = $this->user('resident@wasiy.test', 'Rosa', 'Portal');
        $claimedResident = $this->resident($account, 'resident@wasiy.test', [
            'user_id' => $portalUser->id,
            'first_name' => 'Rosa',
            'last_name' => 'Portal',
            'phone' => '999-100-100',
            'status' => RegistryStatus::Active,
        ]);
        $multiUnitResident = $this->resident($account, 'multi.resident@wasiy.test', [
            'user_id' => null,
            'first_name' => 'Carlos',
            'last_name' => 'Multiunidad',
            'phone' => '999-200-200',
            'status' => RegistryStatus::Active,
        ]);
        $invitedResident = $this->resident($account, 'invited.resident@wasiy.test', [
            'user_id' => null,
            'first_name' => 'Lucia',
            'last_name' => 'Invitada',
            'phone' => '999-300-300',
            'status' => RegistryStatus::Active,
        ]);

        $this->membership($account, $centralLocation, $central101, $claimedResident, [
            'resident_type' => ResidentType::Owner,
            'status' => RegistryStatus::Active,
            'is_primary_contact' => true,
            'started_at' => '2026-01-01',
            'ended_at' => null,
        ]);
        $this->membership($account, $centralLocation, $central102, $multiUnitResident, [
            'resident_type' => ResidentType::Tenant,
            'status' => RegistryStatus::Active,
            'is_primary_contact' => false,
            'started_at' => '2026-02-01',
            'ended_at' => null,
        ]);
        $this->membership($account, $northTower, $north501, $multiUnitResident, [
            'resident_type' => ResidentType::Occupant,
            'status' => RegistryStatus::Active,
            'is_primary_contact' => false,
            'started_at' => '2026-03-01',
            'ended_at' => null,
        ]);
        $this->membership($account, $centralLocation, $central201, $invitedResident, [
            'resident_type' => ResidentType::Tenant,
            'status' => RegistryStatus::Active,
            'is_primary_contact' => false,
            'started_at' => '2026-04-01',
            'ended_at' => null,
        ]);

        $this->residentInvitation($account, $centralLocation, $invitedResident, $manager);

        $this->vehicle($account, $centralLocation, $central101, 'ABC-101', [
            'vehicle_type' => VehicleType::Car,
            'make' => 'Toyota',
            'model' => 'Yaris',
            'color' => 'Rojo',
            'status' => RegistryStatus::Active,
            'notes' => 'Vehiculo del usuario residente demo.',
        ]);
        $this->vehicle($account, $centralLocation, $central102, 'XYZ-102', [
            'vehicle_type' => VehicleType::Motorcycle,
            'make' => 'Honda',
            'model' => 'Wave',
            'color' => 'Azul',
            'status' => RegistryStatus::Active,
            'notes' => null,
        ]);
        $this->vehicle($account, $northTower, $north502, 'BIKE-502', [
            'vehicle_type' => VehicleType::Bicycle,
            'make' => null,
            'model' => null,
            'color' => 'Negro',
            'status' => RegistryStatus::Active,
            'notes' => null,
        ]);
    }

    /**
     * @param  array{building_name?: string|null, floor?: string|null, status: RegistryStatus, notes?: string|null}  $attributes
     */
    private function unit(Account $account, Location $location, string $unitNumber, array $attributes): Unit
    {
        return Unit::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'location_id' => $location->id,
                'unit_number' => $unitNumber,
                'building_name' => $attributes['building_name'] ?? null,
            ],
            [
                'floor' => $attributes['floor'] ?? null,
                'status' => $attributes['status'],
                'notes' => $attributes['notes'] ?? null,
            ],
        );
    }

    /**
     * @param  array{user_id?: string|null, first_name: string, last_name: string, phone?: string|null, status: RegistryStatus}  $attributes
     */
    private function resident(Account $account, string $email, array $attributes): Resident
    {
        return Resident::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'email' => $email,
            ],
            [
                'user_id' => $attributes['user_id'] ?? null,
                'first_name' => $attributes['first_name'],
                'last_name' => $attributes['last_name'],
                'phone' => $attributes['phone'] ?? null,
                'status' => $attributes['status'],
            ],
        );
    }

    /**
     * @param  array{resident_type: ResidentType, status: RegistryStatus, is_primary_contact: bool, started_at: string|null, ended_at: string|null}  $attributes
     */
    private function membership(Account $account, Location $location, Unit $unit, Resident $resident, array $attributes): UnitMembership
    {
        $membership = UnitMembership::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'resident_id' => $resident->id,
                'unit_id' => $unit->id,
            ],
            [
                'location_id' => $location->id,
                'resident_type' => $attributes['resident_type'],
                'status' => $attributes['status'],
                'is_primary_contact' => false,
                'started_at' => $attributes['started_at'],
                'ended_at' => $attributes['ended_at'],
            ],
        );

        if ($attributes['is_primary_contact']) {
            $membership->markAsPrimaryContact();
            $membership->refresh();
        } else {
            $membership->forceFill(['is_primary_contact' => false])->save();
        }

        return $membership;
    }

    private function residentInvitation(Account $account, Location $location, Resident $resident, User $manager): UserInvitation
    {
        return UserInvitation::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'resident_id' => $resident->id,
                'purpose' => UserInvitationPurpose::Resident,
            ],
            [
                'location_id' => $location->id,
                'user_id' => null,
                'email' => $resident->email,
                'first_name' => $resident->first_name,
                'last_name' => $resident->last_name,
                'token_hash' => hash('sha256', 'resident-demo-invitation-token'),
                'status' => UserInvitationStatus::Pending,
                'expires_at' => now()->addDays((int) config('wasiy.invitations.resident_expires_days', 14)),
                'accepted_at' => null,
                'invited_by_user_id' => $manager->id,
            ],
        );
    }

    /**
     * @param  array{vehicle_type: VehicleType, make?: string|null, model?: string|null, color?: string|null, status: RegistryStatus, notes?: string|null}  $attributes
     */
    private function vehicle(Account $account, Location $location, Unit $unit, string $plate, array $attributes): Vehicle
    {
        return Vehicle::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'location_id' => $location->id,
                'plate' => $plate,
            ],
            [
                'unit_id' => $unit->id,
                'vehicle_type' => $attributes['vehicle_type'],
                'make' => $attributes['make'] ?? null,
                'model' => $attributes['model'] ?? null,
                'color' => $attributes['color'] ?? null,
                'status' => $attributes['status'],
                'notes' => $attributes['notes'] ?? null,
            ],
        );
    }
}
