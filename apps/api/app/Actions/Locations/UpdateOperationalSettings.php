<?php

namespace App\Actions\Locations;

use App\Data\OperationalSettings;
use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;

/**
 * The single writer for both levels of the settings cascade. Merge
 * semantics, so the Configuración tab's per-group saves never clobber each
 * other: a key present with a value becomes that level's override, a key
 * present as null clears the override back to inherited, and an absent key
 * is untouched.
 */
class UpdateOperationalSettings
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public function handle(Account|Location $owner, User $actor, array $input): Account|Location
    {
        return DB::transaction(function () use ($owner, $actor, $input): Account|Location {
            $overrides = $owner->settings ?? [];

            foreach ($input as $key => $value) {
                if ($value === null) {
                    unset($overrides[$key]);
                } else {
                    $overrides[$key] = $value;
                }
            }

            // The request validated shapes per key; this guard keeps a
            // programmatic caller from persisting junk the resolver would
            // then throw on at every read.
            OperationalSettings::assertValidOverrides($overrides);

            $owner->forceFill(['settings' => $overrides === [] ? null : $overrides])->save();

            $account = $owner instanceof Location ? $owner->account : $owner;

            $this->activityLogger->log(
                account: $account,
                eventType: $owner instanceof Location
                    ? ActivityEventType::LocationSettingsChanged
                    : ActivityEventType::AccountSettingsChanged,
                summary: $owner instanceof Location
                    ? "Se cambió la configuración de la ubicación {$owner->name}."
                    : "Se cambió la configuración de la cuenta {$owner->name}.",
                metadata: [
                    'changed_keys' => array_keys($input),
                ],
                location: $owner instanceof Location ? $owner : null,
                actor: $actor,
                subjectType: $owner instanceof Location ? 'location' : 'account',
                subjectId: $owner->id,
            );

            return $owner;
        });
    }
}
