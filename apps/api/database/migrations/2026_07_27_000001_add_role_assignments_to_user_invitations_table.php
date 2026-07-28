<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('user_invitations', function (Blueprint $table) {
            // Holds the Account and Location roles a Staff invitee receives on
            // acceptance. Resident invitations leave this null; their access
            // derives from unit memberships that already exist.
            $table->json('role_assignments')->nullable()->after('purpose');
        });

        // Pending Staff invitations were issued under the old behaviour, which
        // granted roles at invite time and discarded the token. They carry no
        // payload and can never be accepted, so cancel them. The people they
        // name already hold their roles; nothing is revoked here.
        DB::table('user_invitations')
            ->where('purpose', 'staff')
            ->where('status', 'pending')
            ->update(['status' => 'cancelled']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_invitations', function (Blueprint $table) {
            $table->dropColumn('role_assignments');
        });
    }
};
