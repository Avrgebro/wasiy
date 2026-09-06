<?php

namespace Database\Factories;

use App\Models\Announcement;
use App\Models\Location;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Announcement> */
class AnnouncementFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $location = Location::factory()->create();
        $body = 'El martes cortaremos el agua de 09:00 a 13:00.';

        return [
            'account_id' => $location->account_id,
            'location_id' => $location->id,
            'author_user_id' => User::factory(),
            'title' => 'Corte de agua programado',
            'body_md' => $body,
            'excerpt' => Announcement::excerptOf($body),
            'is_important' => false,
            'publish_at' => now()->subMinute(),
            'published_at' => now()->subMinute(),
            'expires_on' => null,
        ];
    }

    public function scheduled(): static
    {
        return $this->state(fn () => ['publish_at' => now()->addDay(), 'published_at' => null]);
    }
}
