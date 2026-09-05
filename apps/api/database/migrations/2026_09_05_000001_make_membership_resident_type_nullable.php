<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Memberships stop carrying a role (owner/tenant/…): a membership means "this
 * person lives here", with one primary contact. The column stays nullable
 * until the CSV import is redesigned; nothing else reads or writes it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('unit_memberships', function (Blueprint $table) {
            $table->string('resident_type')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('unit_memberships', function (Blueprint $table) {
            $table->string('resident_type')->nullable(false)->default('occupant')->change();
        });
    }
};
