<?php

namespace App\Actions\Registration;

use App\Actions\Locations\CreateLocation;
use App\Enums\AccountRole;
use App\Enums\LocationType;
use App\Enums\SubscriptionStatus;
use App\Models\Account;
use App\Models\Plan;
use App\Models\StaffMembership;
use App\Models\Subscription;
use App\Models\User;
use App\Support\PendingRegistration;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CompleteRegistration
{
    /**
     * Self-serve signup is Peru-only for launch: one multifamily building in
     * Lima time, priced in PEN. Widening the market means adding countries
     * here and deriving timezone and currency from the chosen one.
     */
    public const COUNTRIES = ['PE'];

    public const TIMEZONE = 'America/Lima';

    public const TRIAL_DAYS = 14;

    public function __construct(private readonly CreateLocation $createLocation) {}

    /** Called within the controller transaction; the caller owns the session. */
    public function handle(PendingRegistration $pending, array $data): User
    {
        if (! $pending->isVerified()) {
            throw ValidationException::withMessages(['code' => 'Confirma tu correo antes de continuar.']);
        }
        if (User::where('email', $pending->email)->exists()) {
            throw ValidationException::withMessages(['email' => 'Este correo ya tiene una cuenta. Inicia sesión.']);
        }
        $plan = Plan::where('code', $data['plan'])->where('is_available', true)->lockForUpdate()->first();
        if (! $plan || $plan->unit_price_minor !== (int) $data['unit_price_minor']) {
            throw ValidationException::withMessages(['plan' => 'El plan o su precio cambió. Actualiza el resumen antes de continuar.']);
        }
        $user = User::create([
            'first_name' => $pending->firstName,
            'last_name' => $pending->lastName,
            'email' => $pending->email,
            'password' => $pending->passwordHash,
        ]);
        $user->forceFill(['email_verified_at' => $pending->verifiedAt])->save();
        $account = Account::create(['name' => $data['name'], 'slug' => Str::slug($data['name']).'-'.Str::lower((string) Str::ulid()), 'timezone' => self::TIMEZONE]);
        StaffMembership::create(['account_id' => $account->id, 'user_id' => $user->id, 'account_role' => AccountRole::AccountAdmin]);
        $this->createLocation->handle($account, $user, [
            'name' => $data['name'], 'type' => LocationType::MultifamilyBuilding,
            'address_line1' => $data['address'], 'district' => $data['district'], 'city' => $data['city'],
            'country' => $data['country'], 'timezone' => self::TIMEZONE,
        ]);
        Subscription::create([
            'account_id' => $account->id, 'plan_id' => $plan->id, 'status' => SubscriptionStatus::Trialing,
            // The real unit count stays on the location; billing covers at least the included units.
            'unit_price_minor' => $plan->unit_price_minor, 'billable_units' => max((int) $data['units'], $plan->included_units), 'currency' => $plan->currency,
            'trial_starts_at' => now(), 'trial_ends_at' => now()->addDays(self::TRIAL_DAYS), 'access_until' => now()->addDays(self::TRIAL_DAYS),
            'terms_accepted_at' => $pending->termsAcceptedAt,
        ]);

        return $user;
    }
}
