<?php

namespace App\Enums;

/**
 * How Wasiy gets paid. Yape and Plin are channels into the bank account,
 * not methods, so they collapse into Transfer. Card exists for the payment
 * provider slice; nothing writes it yet.
 */
enum PaymentMethod: string
{
    case Transfer = 'transfer';
    case Card = 'card';
}
