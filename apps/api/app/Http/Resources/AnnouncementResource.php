<?php

namespace App\Http\Resources;

use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Announcement */
class AnnouncementResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'location_id' => $this->location_id,
            'title' => $this->title,
            'body_md' => $this->body_md,
            'body_html' => Announcement::renderHtml($this->body_md),
            'excerpt' => $this->excerpt,
            'is_important' => $this->is_important,
            // Derived from the timestamps below, in the location's day.
            'status' => $this->status()->value,
            'publish_at' => $this->publish_at->toJSON(),
            'published_at' => $this->published_at?->toJSON(),
            'expires_on' => $this->expires_on?->toDateString(),
            'archived_at' => $this->archived_at?->toJSON(),
            'author_name' => $this->whenLoaded('author', fn () => $this->author?->name),
            'notified_count' => $this->notified_count,
            'emailed_count' => $this->emailed_count,
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
