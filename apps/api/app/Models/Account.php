<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'timezone'])]
class Account extends Model
{
    use HasFactory, HasUlids;

    /**
     * @return HasMany<Location, $this>
     */
    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }

    /**
     * @return HasMany<AccountUserRole, $this>
     */
    public function accountUserRoles(): HasMany
    {
        return $this->hasMany(AccountUserRole::class);
    }

    /**
     * @return HasMany<LocationUserRole, $this>
     */
    public function locationUserRoles(): HasMany
    {
        return $this->hasMany(LocationUserRole::class);
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'account_user_roles')
            ->withPivot('role')
            ->withTimestamps();
    }
}
