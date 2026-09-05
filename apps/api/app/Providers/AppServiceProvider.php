<?php

namespace App\Providers;

use App\Models\Amenity;
use App\Models\Location;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Stable storage aliases for polymorphic types: rows say
        // 'location', never a class name that a refactor could orphan.
        Relation::enforceMorphMap([
            'amenity' => Amenity::class,
            'location' => Location::class,
        ]);

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        // Case- and accent-insensitive substring search over the given SQL
        // expressions, with LIKE wildcards in the term escaped. Single owner
        // of the escaping rule for every list endpoint and the spotlight.
        Builder::macro('searchLike', function (array $expressions, string $search): Builder {
            /** @var Builder $this */
            $likeSearch = '%'.addcslashes(Str::lower(trim($search)), '\\%_').'%';

            return $this->where(function (Builder $query) use ($expressions, $likeSearch): void {
                foreach ($expressions as $index => $expression) {
                    $method = $index === 0 ? 'whereRaw' : 'orWhereRaw';
                    $query->{$method}("unaccent(LOWER({$expression})) LIKE unaccent(?)", [$likeSearch]);
                }
            });
        });
    }
}
