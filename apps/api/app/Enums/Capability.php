<?php

namespace App\Enums;

/**
 * What a staff member may do in a Location. Roles are what people are
 * assigned; capabilities are what the code checks. The matrix in
 * forRoles() is the single source of truth for both the API policies and
 * the SPA (it travels in /me as active_location.capabilities), so the two
 * can never disagree about who sees what. ADR 0036 documents the matrix.
 */
enum Capability: string
{
    /** Read units, residents (phones, never emails for the desk), vehicles. */
    case ViewRegistry = 'registry.view';

    /** Create and edit units, residents, memberships, vehicles; import and export. */
    case ManageRegistry = 'registry.manage';

    /** Register visits and packages, check out, deliver. */
    case ManageReception = 'reception.manage';

    /** See the reservations calendar and amenities. */
    case ViewReservations = 'reservations.view';

    /** Request and cancel bookings on behalf of residents. */
    case CreateReservations = 'reservations.create';

    /** Approve, observe or reject bookings; manage amenities. */
    case DecideReservations = 'reservations.decide';

    /** The ledger: movements, dues, deposits, and the Panel's management strip. */
    case ManageFinances = 'finances.manage';

    case ManageAnnouncements = 'announcements.manage';

    /** Tune how the Location operates (auto check-out hours, booking windows). */
    case ManageLocationSettings = 'location.settings';

    /** Account-wide: locations, staff, activity, settings. */
    case ManageAccount = 'account.manage';

    /**
     * The permission matrix. An account admin holds every capability in every
     * Location of the account; a location role grants its row in that
     * Location only.
     *
     * @return list<self>
     */
    public static function forRoles(bool $isAccountAdmin, ?LocationRole $locationRole): array
    {
        if ($isAccountAdmin) {
            return self::cases();
        }

        return match ($locationRole) {
            LocationRole::LocationManager => [
                self::ViewRegistry,
                self::ManageRegistry,
                self::ManageReception,
                self::ViewReservations,
                self::CreateReservations,
                self::DecideReservations,
                self::ManageFinances,
                self::ManageAnnouncements,
                self::ManageLocationSettings,
            ],
            LocationRole::FrontDesk => [
                self::ViewRegistry,
                self::ManageReception,
                self::ViewReservations,
            ],
            null => [],
        };
    }

    /**
     * @return list<string>
     */
    public static function valuesForRoles(bool $isAccountAdmin, ?LocationRole $locationRole): array
    {
        return array_map(fn (self $capability): string => $capability->value, self::forRoles($isAccountAdmin, $locationRole));
    }
}
