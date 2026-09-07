<?php

namespace App\Enums;

/**
 * Where an invoice stands (ADR 0040). Access is never gated on this: it is
 * the customer's and the team's view of the payment, and confirming a
 * payment is what moves Subscription::access_until.
 */
enum InvoiceStatus: string
{
    /** Issued, waiting for the customer to pay and upload the proof. */
    case Pending = 'pending';

    /** A proof was uploaded; the Wasiy team is checking the bank statement. */
    case UnderReview = 'under_review';

    /** The team saw the money; access_until moved to the period end. */
    case Paid = 'paid';

    /** The latest proof did not match; the customer can upload again. */
    case Rejected = 'rejected';

    /** Whether the customer may upload a proof right now. */
    public function acceptsProof(): bool
    {
        return $this === self::Pending || $this === self::Rejected;
    }
}
