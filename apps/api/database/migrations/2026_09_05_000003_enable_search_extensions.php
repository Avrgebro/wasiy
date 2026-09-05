<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Global search (spotlight) matches "nunez" to "Núñez" and, when a location
 * grows, ranks by trigram similarity. Both are trusted contrib extensions;
 * enabling them here keeps the searchLike macro's SQL valid everywhere.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS unaccent');
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    }

    public function down(): void
    {
        DB::statement('DROP EXTENSION IF EXISTS pg_trgm');
        DB::statement('DROP EXTENSION IF EXISTS unaccent');
    }
};
