<?php

namespace App\Data;

use Illuminate\Contracts\Support\Arrayable;
use InvalidArgumentException;
use JsonSerializable;

/**
 * The resolved operational policy for one level of the Account → Location
 * cascade (reservation policy left the cascade in ADR 0041). Every key has a system default, so a fully absent settings
 * column and a fully populated one behave identically at the call site.
 *
 * Instances are always fully resolved: partial override layers exist only in
 * storage and inside resolve(). Callers never read raw array keys.
 *
 * @implements Arrayable<string, mixed>
 */
class OperationalSettings implements Arrayable, JsonSerializable
{
    /**
     * System defaults. This is also the single declaration of which keys
     * exist: an override layer may only contain keys listed here.
     */
    public const DEFAULTS = [
        'visitor_preregistration_enabled' => true,
        // Zero means visits without a recorded exit stay open forever. The
        // "never" case is 0, not null: in the settings write contract a JSON
        // null always means "clear this override back to inherited".
        'visitor_auto_checkout_hours' => 0,
        'quiet_hours_enabled' => false,
        'quiet_hours_start' => null,
        'quiet_hours_end' => null,
        'announcements_location_manager_can_post' => true,
        'announcements_email_residents' => false,
    ];

    public function __construct(
        public readonly bool $visitorPreregistrationEnabled,
        public readonly int $visitorAutoCheckoutHours,
        public readonly bool $quietHoursEnabled,
        public readonly ?string $quietHoursStart,
        public readonly ?string $quietHoursEnd,
        public readonly bool $announcementsLocationManagerCanPost,
        public readonly bool $announcementsEmailResidents,
    ) {}

    public static function defaults(): self
    {
        return self::resolve();
    }

    /**
     * Resolve override layers over the system defaults, nearest layer last.
     * A key absent from a layer inherits; a key explicitly set — even to the
     * same value as the parent — stops inheriting.
     *
     * @param  array<string, mixed>  ...$overrideLayers
     */
    public static function resolve(array ...$overrideLayers): self
    {
        $values = self::DEFAULTS;

        foreach ($overrideLayers as $layer) {
            self::assertValidOverrides($layer);
            $values = array_replace($values, $layer);
        }

        return new self(
            visitorPreregistrationEnabled: $values['visitor_preregistration_enabled'],
            visitorAutoCheckoutHours: $values['visitor_auto_checkout_hours'],
            quietHoursEnabled: $values['quiet_hours_enabled'],
            quietHoursStart: $values['quiet_hours_start'],
            quietHoursEnd: $values['quiet_hours_end'],
            announcementsLocationManagerCanPost: $values['announcements_location_manager_can_post'],
            announcementsEmailResidents: $values['announcements_email_residents'],
        );
    }

    /**
     * Reject an override layer that names a key this object does not declare
     * or gives a key a value of the wrong shape. Form requests give users
     * friendly messages; this guard is the last line for programmatic writes.
     *
     * @param  array<string, mixed>  $overrides
     */
    public static function assertValidOverrides(array $overrides): void
    {
        foreach ($overrides as $key => $value) {
            if (! array_key_exists($key, self::DEFAULTS)) {
                throw new InvalidArgumentException("Unknown operational setting [{$key}].");
            }

            $valid = match ($key) {
                'visitor_preregistration_enabled',
                'quiet_hours_enabled',
                'announcements_location_manager_can_post',
                'announcements_email_residents' => is_bool($value),
                'visitor_auto_checkout_hours' => is_int($value) && $value >= 0,
                // Stored override layers never hold null: null in a write
                // payload means "clear the override", handled before storage.
                'quiet_hours_start',
                'quiet_hours_end' => is_string($value)
                    && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value) === 1,
            };

            if (! $valid) {
                throw new InvalidArgumentException("Invalid value for operational setting [{$key}].");
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'visitor_preregistration_enabled' => $this->visitorPreregistrationEnabled,
            'visitor_auto_checkout_hours' => $this->visitorAutoCheckoutHours,
            'quiet_hours_enabled' => $this->quietHoursEnabled,
            'quiet_hours_start' => $this->quietHoursStart,
            'quiet_hours_end' => $this->quietHoursEnd,
            'announcements_location_manager_can_post' => $this->announcementsLocationManagerCanPost,
            'announcements_email_residents' => $this->announcementsEmailResidents,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
