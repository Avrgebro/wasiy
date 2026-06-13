<?php

namespace App\Enums;

enum VehicleType: string
{
    case Car = 'car';
    case Motorcycle = 'motorcycle';
    case Bicycle = 'bicycle';
    case Other = 'other';
}
