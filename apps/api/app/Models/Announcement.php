<?php

namespace App\Models;

use App\Enums\AnnouncementStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['account_id', 'location_id', 'author_user_id', 'title', 'body_md', 'excerpt', 'is_important', 'publish_at', 'expires_on'])]
class Announcement extends Model
{
    use HasFactory, HasUlids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_important' => 'boolean',
            'publish_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
            'expires_on' => 'immutable_date',
            'archived_at' => 'immutable_datetime',
            'notified_count' => 'integer',
            'emailed_count' => 'integer',
        ];
    }

    /** @return BelongsTo<Account, $this> */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /** @return BelongsTo<Location, $this> */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    /** The last calendar day the post shows, in the location's timezone. */
    public function status(?CarbonImmutable $now = null): AnnouncementStatus
    {
        if ($this->archived_at !== null) {
            return AnnouncementStatus::Archived;
        }
        if ($this->published_at === null) {
            return AnnouncementStatus::Scheduled;
        }
        $today = ($now ?? CarbonImmutable::now())->setTimezone($this->location->timezone)->toDateString();
        if ($this->expires_on !== null && $this->expires_on->toDateString() < $today) {
            return AnnouncementStatus::Expired;
        }

        return AnnouncementStatus::Active;
    }

    /**
     * @param  Builder<Announcement>  $query
     * @param  string  $today  Y-m-d in the location's timezone
     */
    public function scopeWithStatus(Builder $query, AnnouncementStatus $status, string $today): void
    {
        match ($status) {
            AnnouncementStatus::Archived => $query->whereNotNull('archived_at'),
            AnnouncementStatus::Scheduled => $query->whereNull('archived_at')->whereNull('published_at'),
            AnnouncementStatus::Expired => $query->whereNull('archived_at')->whereNotNull('published_at')->whereDate('expires_on', '<', $today),
            AnnouncementStatus::Active => $query->whereNull('archived_at')->whereNotNull('published_at')
                ->where(fn (Builder $live) => $live->whereNull('expires_on')->orWhereDate('expires_on', '>=', $today)),
        };
    }

    /** Markdown subset → HTML. Raw HTML in the source is stripped, so nothing needs sanitizing after. */
    public static function renderHtml(string $markdown): string
    {
        return trim(Str::markdown($markdown, ['html_input' => 'strip', 'allow_unsafe_links' => false]));
    }

    /** The first paragraph as plain text: what alerts, WhatsApp and the home card carry. */
    public static function excerptOf(string $markdown): string
    {
        $blocks = preg_split("/\n\s*\n/", trim($markdown)) ?: [];
        $first = trim((string) ($blocks[0] ?? ''));
        $text = strip_tags(Str::inlineMarkdown($first, ['html_input' => 'strip', 'allow_unsafe_links' => false]));

        return Str::of(html_entity_decode($text))->squish()->limit(280)->toString();
    }
}
