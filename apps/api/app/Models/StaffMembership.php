<?php

namespace App\Models;

use App\Enums\AccountRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The source of truth for "this User is staff of this Account" (ADR 0033).
 * Owns the optional account-level role and per-account deactivation; the
 * membership's location roles hang off it. account_role and location roles
 * are mutually exclusive — enforced in the staff requests and actions.
 */
#[Fillable(['account_id', 'user_id', 'account_role', 'deactivated_at'])]
class StaffMembership extends Model
{
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'account_role' => AccountRole::class,
            'deactivated_at' => 'datetime',
        ];
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
     * @return BelongsTo<Account, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<StaffLocationRole, $this>
     */
    public function locationRoles(): HasMany
    {
        return $this->hasMany(StaffLocationRole::class);
    }
}
