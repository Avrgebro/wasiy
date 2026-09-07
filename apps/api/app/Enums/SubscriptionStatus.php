<?php

namespace App\Enums;

/**
 * Where an Account stands with its plan. Access is gated on
 * Subscription::access_until, not on this status: the status is the
 * reporting view of the same fact, kept in step by subscriptions:expire-lapsed
 * (ADR 0039).
 */
enum SubscriptionStatus: string
{
    /** Inside the free trial that self-serve registration starts. */
    case Trialing = 'trialing';

    /** Paid; access_until is the end of the paid period. */
    case Active = 'active';

    /** access_until has passed without a payment extending it. */
    case Expired = 'expired';
}
