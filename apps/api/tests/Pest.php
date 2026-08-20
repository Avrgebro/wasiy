<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
 // ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

/**
 * The membership for (account, user), created if missing. Passing a role
 * sets it; omitting it leaves an existing role untouched.
 */
function createStaffMembership(
    App\Models\Account $account,
    App\Models\User $user,
    App\Enums\AccountRole|string|null $accountRole = null,
): App\Models\StaffMembership {
    $membership = App\Models\StaffMembership::query()->firstOrCreate([
        'account_id' => $account->id,
        'user_id' => $user->id,
    ]);

    if ($accountRole !== null) {
        $membership->forceFill([
            'account_role' => $accountRole instanceof App\Enums\AccountRole
                ? $accountRole
                : App\Enums\AccountRole::from($accountRole),
        ])->save();
    }

    return $membership;
}

function grantLocationRole(
    App\Models\Account $account,
    App\Models\Location $location,
    App\Models\User $user,
    App\Enums\LocationRole|string $role,
): App\Models\StaffMembership {
    $membership = createStaffMembership($account, $user);

    App\Models\StaffLocationRole::query()->updateOrCreate(
        [
            'staff_membership_id' => $membership->id,
            'location_id' => $location->id,
        ],
        [
            'account_id' => $account->id,
            'role' => $role instanceof App\Enums\LocationRole
                ? $role
                : App\Enums\LocationRole::from($role),
        ],
    );

    return $membership;
}

function userHasLocationRole(
    App\Models\Account $account,
    App\Models\Location $location,
    App\Models\User $user,
    App\Enums\LocationRole|string|null $role = null,
): bool {
    $roleValue = $role instanceof App\Enums\LocationRole ? $role->value : $role;

    return App\Models\StaffLocationRole::query()
        ->where('account_id', $account->id)
        ->where('location_id', $location->id)
        ->when($roleValue !== null, fn ($query) => $query->where('role', $roleValue))
        ->whereHas('membership', fn ($query) => $query->where('user_id', $user->id))
        ->exists();
}
