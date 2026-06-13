<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\ExportStatus;
use App\Enums\ExportType;
use App\Http\Controllers\Controller;
use App\Http\Resources\RegistryExportResource;
use App\Jobs\GenerateCsvExport;
use App\Models\Account;
use App\Models\Location;
use App\Models\RegistryExport;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RegistryExportController extends Controller
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'account_id' => ['required', 'string', 'ulid', Rule::exists('accounts', 'id')->whereNull('deleted_at')],
            'location_id' => ['sometimes', 'nullable', 'string', 'ulid', Rule::exists('locations', 'id')->where('account_id', $request->input('account_id'))->whereNull('deleted_at')],
            'status' => ['sometimes', 'nullable', Rule::enum(ExportStatus::class)],
            'export_type' => ['sometimes', 'nullable', Rule::enum(ExportType::class)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $account = Account::query()->findOrFail($validated['account_id']);
        Gate::authorize('viewAny', [RegistryExport::class, $account]);

        /** @var User $user */
        $user = $request->user();
        $locationId = $validated['location_id'] ?? null;

        $exports = RegistryExport::query()
            ->where('account_id', $account->id)
            ->when($locationId, fn (Builder $query, string $locationId) => $query->where('location_id', $locationId))
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['export_type'] ?? null, fn (Builder $query, string $exportType) => $query->where('export_type', $exportType));

        if (! $this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin)) {
            $exports->whereIn('location_id', $this->access->accessibleLocationsForAccount($user, $account)->pluck('id'));
        }

        return RegistryExportResource::collection(
            $exports
                ->orderByDesc('created_at')
                ->paginate((int) ($validated['per_page'] ?? 15))
                ->withQueryString()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'account_id' => ['required', 'string', 'ulid', Rule::exists('accounts', 'id')->whereNull('deleted_at')],
            'location_id' => ['sometimes', 'nullable', 'string', 'ulid', Rule::exists('locations', 'id')->where('account_id', $request->input('account_id'))->whereNull('deleted_at')],
            'export_type' => ['required', Rule::enum(ExportType::class)],
            'filters' => ['sometimes', 'array'],
        ]);

        $account = Account::query()->findOrFail($validated['account_id']);
        $location = isset($validated['location_id'])
            ? Location::query()->where('account_id', $account->id)->findOrFail($validated['location_id'])
            : null;

        /** @var User $user */
        $user = $request->user();

        if (! $this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin) && $location === null) {
            throw ValidationException::withMessages([
                'location_id' => __('Location is required for location-scoped exports.'),
            ]);
        }

        Gate::authorize('create', [RegistryExport::class, $account, $location]);

        $export = RegistryExport::query()->create([
            'account_id' => $account->id,
            'location_id' => $location?->id,
            'requested_by_user_id' => $user->id,
            'export_type' => $validated['export_type'],
            'filters' => $validated['filters'] ?? [],
            'status' => ExportStatus::Pending,
            'disk' => config('wasiy.exports.disk', 'local'),
            'filename' => $this->filename($validated['export_type'], $location),
            'expires_at' => now()->addDays((int) config('wasiy.exports.expires_days', 7)),
        ]);

        $this->activityLogger->log(
            account: $account,
            eventType: ActivityEventType::ExportRequested,
            summary: 'Exportacion CSV solicitada.',
            metadata: [
                'export_id' => $export->id,
                'export_type' => $export->export_type->value,
                'filters' => $export->filters,
                'location_id' => $location?->id,
                'actor_user_id' => $user->id,
            ],
            location: $location,
            actor: $user,
            subjectType: RegistryExport::class,
            subjectId: $export->id,
        );

        GenerateCsvExport::dispatch($export);

        return (new RegistryExportResource($export))->response()->setStatusCode(201);
    }

    public function show(RegistryExport $export): RegistryExportResource
    {
        Gate::authorize('view', $export);

        return new RegistryExportResource($export);
    }

    public function download(RegistryExport $export): StreamedResponse
    {
        Gate::authorize('download', $export);

        abort_if(
            $export->status !== ExportStatus::Ready || $export->path === null || $export->disk === null,
            409,
            __('The export is not ready for download.'),
        );

        abort_unless(Storage::disk($export->disk)->exists($export->path), 404);

        return Storage::disk($export->disk)->download($export->path, $export->filename);
    }

    private function filename(string $exportType, ?Location $location): string
    {
        $prefix = match ($exportType) {
            ExportType::RegistryUnitsResidents->value => 'registro-unidades-residentes',
            ExportType::Vehicles->value => 'vehiculos',
            default => 'exportacion',
        };

        $scope = $location ? Str::slug($location->slug) : 'cuenta';

        return "{$prefix}-{$scope}-".now()->format('Ymd-His').'.csv';
    }
}
