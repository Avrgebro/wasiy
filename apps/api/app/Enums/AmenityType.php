<?php

namespace App\Enums;

enum AmenityType: string
{
    case Pool = 'pool';
    case Gym = 'gym';
    case EventRoom = 'event_room';
    case MeetingRoom = 'meeting_room';
    case Court = 'court';
    case Rooftop = 'rooftop';
    case Other = 'other';
}
