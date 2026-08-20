<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['first_name', 'last_name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasUlids, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'deactivated_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function getNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function isDeactivated(): bool
    {
        return $this->deactivated_at !== null;
    }

    public function deactivate(): bool
    {
        return $this->forceFill([
            'deactivated_at' => $this->freshTimestamp(),
        ])->save();
    }

    public function activate(): bool
    {
        return $this->forceFill([
            'deactivated_at' => null,
        ])->save();
    }

    /**
     * @return HasMany<StaffMembership, $this>
     */
    public function staffMemberships(): HasMany
    {
        return $this->hasMany(StaffMembership::class)
            ->whereHas('account');
    }

    /**
     * Eager loads shared by staff endpoints and StaffResource. Constrains
     * the membership to the Account so the resource can render it as-is.
     *
     * @return array<string, callable>
     */
    public static function staffRelationsForAccount(Account $account): array
    {
        return [
            'staffMemberships' => fn ($query) => $query
                ->where('account_id', $account->id)
                // Roles pointing at soft-deleted locations don't render.
                ->with(['locationRoles' => fn ($query) => $query
                    ->whereHas('location')
                    ->with('location'),
                ]),
        ];
    }

    public function loadStaffRelationsForAccount(Account $account): self
    {
        return $this->load(self::staffRelationsForAccount($account));
    }

    /**
     * The loaded membership for one Account. Callers must have eager-loaded
     * staffMemberships (see staffRelationsForAccount).
     */
    public function staffMembershipForAccount(Account $account): ?StaffMembership
    {
        return $this->staffMemberships
            ->firstWhere('account_id', $account->id);
    }

    /**
     * @return HasMany<UserInvitation, $this>
     */
    public function userInvitations(): HasMany
    {
        return $this->hasMany(UserInvitation::class);
    }

    /**
     * @return HasMany<Resident, $this>
     */
    public function residents(): HasMany
    {
        return $this->hasMany(Resident::class);
    }
}
