<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P5: location-wide posts for residents (mockups 18, 18b, 18c). State is
 * derived from three timestamps: publish_at (when it goes live; future =
 * scheduled), published_at (set when the fan-out actually ran), archived_at,
 * plus expires_on, the last day it shows in the portal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('account_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('location_id');
            $table->foreignUlid('author_user_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 160);
            // Markdown subset (bold, italic, lists, links); rendered on the way out.
            $table->text('body_md');
            // First paragraph as plain text: alert rows, WhatsApp, home card.
            $table->string('excerpt', 300);
            $table->boolean('is_important')->default(false);
            $table->timestamp('publish_at');
            $table->timestamp('published_at')->nullable();
            $table->date('expires_on')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->unsignedInteger('notified_count')->default(0);
            $table->unsignedInteger('emailed_count')->default(0);
            $table->timestamps();

            $table->foreign(['location_id', 'account_id'])->references(['id', 'account_id'])->on('locations')->cascadeOnDelete();
            $table->index(['location_id', 'archived_at', 'publish_at']);
            $table->index(['published_at', 'publish_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
