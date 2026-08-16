<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the local demo environment. Each seeder is idempotent and owns
     * one concern; order matters because later seeders look up records the
     * earlier ones create.
     */
    public function run(): void
    {
        $this->call([
            DemoAccountsSeeder::class,
            DemoRegistrySeeder::class,
            DemoInvitationsSeeder::class,
        ]);
    }
}
