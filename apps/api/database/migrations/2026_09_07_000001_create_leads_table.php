<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Inbound requests from the marketing site: the contact form on the landing
 * (source contacto) and the demo request page (source demo). Stored before
 * anyone is notified so a mail outage never loses a lead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('source', 20);
            $table->string('name', 120);
            $table->string('email');
            $table->string('phone', 40)->nullable();
            $table->string('organization', 150)->nullable();
            // Contact form: who they are. Demo form: how many units, as a range.
            $table->string('profile', 60)->nullable();
            $table->unsignedInteger('units')->nullable();
            $table->string('units_range', 20)->nullable();
            $table->json('interests')->nullable();
            $table->string('preferred_slot', 20)->nullable();
            $table->text('message')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->index(['source', 'created_at']);
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
