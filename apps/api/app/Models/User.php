<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
     * @return HasMany<AccountUserRole, $this>
     */
    public function accountUserRoles(): HasMany
    {
        return $this->hasMany(AccountUserRole::class)
            ->whereHas('account');
    }

    /**
     * @return HasMany<LocationUserRole, $this>
     */
    public function locationUserRoles(): HasMany
    {
        return $this->hasMany(LocationUserRole::class)
            ->whereHas('account')
            ->whereHas('location');
    }

    /**
     * Eager loads shared by staff endpoints and StaffResource. Constrains
     * role relations to the Account so the resource can render them as-is.
     *
     * @return array<string, callable>
     */
    public static function staffRelationsForAccount(Account $account): array
    {
        return [
            'accountUserRoles' => fn ($query) => $query->where('account_id', $account->id),
            'locationUserRoles' => fn ($query) => $query
                ->where('account_id', $account->id)
                ->with('location'),
        ];
    }

    public function loadStaffRelationsForAccount(Account $account): self
    {
        return $this->load(self::staffRelationsForAccount($account));
    }

    /**
     * @return HasMany<UserInvitation, $this>
     */
    public function userInvitations(): HasMany
    {
        return $this->hasMany(UserInvitation::class);
    }

    /**
     * @return BelongsToMany<Account, $this>
     */
    public function accounts(): BelongsToMany
    {
        return $this->belongsToMany(Account::class, 'account_user_roles')
            ->withPivot('role')
            ->withTimestamps();
    }

    /**
     * @return BelongsToMany<Location, $this>
     */
    public function assignedLocations(): BelongsToMany
    {
        return $this->belongsToMany(Location::class, 'location_user_roles')
            ->withPivot(['account_id', 'role'])
            ->withTimestamps();
    }
}
