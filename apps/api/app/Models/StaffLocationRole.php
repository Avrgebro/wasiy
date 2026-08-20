<?php

namespace App\Models;

use App\Enums\LocationRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A StaffMembership's role at one Location. Composite foreign keys guarantee
 * the location belongs to the membership's account; account_id is stored so
 * the database can prove it.
 */
#[Fillable(['staff_membership_id', 'account_id', 'location_id', 'role'])]
class StaffLocationRole extends Model
{
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => LocationRole::class,
        ];
    }

    /**
     * @return BelongsTo<StaffMembership, $this>
     */
    public function membership(): BelongsTo
    {
        return $this->belongsTo(StaffMembership::class, 'staff_membership_id');
    }

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}
