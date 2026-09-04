<?php

namespace App\Enums;

enum PackageStatus: string
{
    case Pending = 'pending';
    case Delivered = 'delivered';
}
