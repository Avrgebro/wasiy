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
        Schema::table('locations', function (Blueprint $table) {
            $table->string('type')->default('other')->after('slug');
            $table->string('address_line1')->nullable()->after('timezone');
            $table->string('address_line2')->nullable()->after('address_line1');
            $table->string('district')->nullable()->after('address_line2');
            $table->string('city')->nullable()->after('district');
            $table->string('state')->nullable()->after('city');
            $table->string('postal_code')->nullable()->after('state');
            $table->string('country', 2)->default('PE')->after('postal_code');
            $table->string('phone')->nullable()->after('country');
            $table->string('contact_email')->nullable()->after('phone');
            $table->text('access_notes')->nullable()->after('contact_email');
            $table->timestamp('deactivated_at')->nullable()->after('access_notes');
            $table->foreignUlid('deactivated_by_user_id')->nullable()->after('deactivated_at')
                ->constrained('users')->nullOnDelete();

            $table->index(['account_id', 'deactivated_at']);
        });

        // The old single-string address becomes line 1; splitting it into
        // real components is data entry, not something a migration can guess.
        DB::table('locations')->update(['address_line1' => DB::raw('address')]);

        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn('address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->string('address')->nullable()->after('timezone');
        });

        DB::table('locations')->update(['address' => DB::raw('address_line1')]);

        Schema::table('locations', function (Blueprint $table) {
            $table->dropIndex(['account_id', 'deactivated_at']);
            $table->dropConstrainedForeignId('deactivated_by_user_id');
            $table->dropColumn([
                'type', 'address_line1', 'address_line2', 'district', 'city',
                'state', 'postal_code', 'country', 'phone', 'contact_email',
                'access_notes', 'deactivated_at',
            ]);
        });
    }
};
