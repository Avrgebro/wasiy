<?php

namespace App\Enums;

/**
 * What a portal alert is about. Kinds group into families, which is the
 * grain at which residents switch email on or off (mockup 03c).
 */
enum ResidentAlertKind: string
{
    case ReservationApproved = 'reservation.approved';
    case ReservationObserved = 'reservation.observed';
    case ReservationRejected = 'reservation.rejected';
    case PackageReceived = 'package.received';
    case PackageDelivered = 'package.delivered';
    case VisitArrived = 'visit.arrived';
    case AnnouncementPublished = 'announcement.published';

    public function family(): ResidentAlertFamily
    {
        return match ($this) {
            self::ReservationApproved, self::ReservationObserved, self::ReservationRejected => ResidentAlertFamily::Reservations,
            self::PackageReceived, self::PackageDelivered => ResidentAlertFamily::Packages,
            self::VisitArrived => ResidentAlertFamily::Visitors,
            self::AnnouncementPublished => ResidentAlertFamily::Announcements,
        };
    }
}
