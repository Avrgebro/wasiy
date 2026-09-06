<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * CSV import (ADR 0026) and queued export (ADR 0027) were removed on
 * 2026-09-06 to be rebuilt from scratch. Their tables go, and so do the
 * activity rows whose event types no longer exist in ActivityEventType,
 * which would otherwise fail the enum cast on read. Files on the import
 * and export disks are not touched here.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('activity_logs')->whereIn('event_type', [
            'export.requested', 'export.completed', 'export.failed',
            'import.uploaded', 'import.validation_failed', 'import.completed', 'import.failed',
        ])->delete();

        Schema::dropIfExists('registry_import_rows');
        Schema::dropIfExists('registry_imports');
        Schema::dropIfExists('exports');
    }

    public function down(): void
    {
        // The features were removed for a rebuild; the schemas they need will
        // come from that rebuild, not from restoring these tables.
    }
};
