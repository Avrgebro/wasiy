<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Delivery keeps a free-text note ("lo retiró su hermana"), not just a name. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->renameColumn('delivered_to', 'delivery_notes');
        });
        Schema::table('packages', function (Blueprint $table) {
            $table->text('delivery_notes')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->string('delivery_notes')->nullable()->change();
        });
        Schema::table('packages', function (Blueprint $table) {
            $table->renameColumn('delivery_notes', 'delivered_to');
        });
    }
};
