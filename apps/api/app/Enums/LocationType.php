<?php

namespace App\Enums;

enum LocationType: string
{
    case MultifamilyBuilding = 'multifamily_building';
    case Condominium = 'condominium';
    case ResidentialCommunity = 'residential_community';
    case Other = 'other';
}
