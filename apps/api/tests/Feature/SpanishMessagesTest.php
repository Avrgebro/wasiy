<?php

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function spanishAdmin(Account $account): User
{
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return $admin;
}

/**
 * The API speaks Spanish in production (APP_LOCALE=es, Laravel-Lang for the
 * framework's strings, lang/es.json for ours). The suite runs in English so
 * message assertions stay stable; these two cover the Spanish side.
 */
test('validation errors reach the client in Spanish with translated field names', function () {
    app()->setLocale('es');
    $account = Account::factory()->create();
    Location::factory()->for($account)->create();
    $admin = spanishAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations", ['type' => 'multifamily_building'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.name.0', 'El campo nombre es obligatorio.')
        ->assertJsonPath('errors.address_line1.0', 'El campo dirección es obligatorio.');
});

test('custom rule messages are translated too', function () {
    app()->setLocale('es');
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = spanishAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations/{$location->id}/deactivate")
        ->assertUnprocessable()
        ->assertJsonPath('errors.location.0', 'Es la única ubicación activa de la cuenta. Crea o reactiva otra ubicación primero.');
});
