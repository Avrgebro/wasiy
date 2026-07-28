<?php

namespace App\Models;

use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use Database\Factories\UserInvitationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'account_id',
    'location_id',
    'user_id',
    'resident_id',
    'email',
    'first_name',
    'last_name',
    'token_hash',
    'purpose',
    'role_assignments',
    'status',
    'expires_at',
    'accepted_at',
    'invited_by_user_id',
])]
class UserInvitation extends Model
{
    /** @use HasFactory<UserInvitationFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'purpose' => UserInvitationPurpose::class,
            'status' => UserInvitationStatus::class,
            'role_assignments' => 'array',
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    /**
     * The Account role this invitation grants on acceptance, if any.
     */
    public function invitedAccountRole(): ?string
    {
        $role = $this->role_assignments['account_role'] ?? null;

        return is_string($role) ? $role : null;
    }

    /**
     * The Location roles this invitation grants on acceptance.
     *
     * @return array<int, array{location_id: string, role: string}>
     */
    public function invitedLocationAssignments(): array
    {
        $assignments = $this->role_assignments['location_assignments'] ?? [];

        if (! is_array($assignments)) {
            return [];
        }

        return array_values(array_filter(
            $assignments,
            fn ($assignment): bool => is_array($assignment)
                && is_string($assignment['location_id'] ?? null)
                && is_string($assignment['role'] ?? null),
        ));
    }

    /**
     * @return BelongsTo<Account, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Resident, $this>
     */
    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_user_id');
    }
}
