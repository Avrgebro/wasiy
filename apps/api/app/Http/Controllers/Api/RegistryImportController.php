<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Http\Controllers\Controller;
use App\Http\Resources\RegistryImportResource;
use App\Http\Resources\RegistryImportRowResource;
use App\Jobs\CommitRegistryImport;
use App\Jobs\ValidateRegistryImport;
use App\Models\Account;
use App\Models\Location;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\ValidationException;
use Throwable;

class RegistryImportController extends Controller
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
            'status' => ['sometimes', 'nullable', Rule::enum(ImportStatus::class)],
            'import_type' => ['sometimes', 'nullable', Rule::enum(ImportType::class)],
            ...$this->paginationRules(),
        ]);

        $account = Account::query()->findOrFail($validated['account_id']);
        $location = isset($validated['location_id'])
            ? Location::query()->where('account_id', $account->id)->findOrFail($validated['location_id'])
            : null;

        Gate::authorize('viewAny', [RegistryImport::class, $account, $location]);

        /** @var User $user */
        $user = $request->user();
        $imports = RegistryImport::query()
            ->where('account_id', $account->id)
            ->when($location, fn (Builder $query, Location $location) => $query->where('location_id', $location->id))
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['import_type'] ?? null, fn (Builder $query, string $importType) => $query->where('import_type', $importType));

        if (! $this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin)) {
            $manageableLocationIds = $this->access->accessibleLocationsForAccount($user, $account)
                ->get()
                ->filter(fn (Location $location): bool => $this->access->canManageRegistry($user, $location))
                ->pluck('id');

            $imports->whereIn('location_id', $manageableLocationIds);
        }

        return RegistryImportResource::collection(
            $imports
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->paginate($this->perPage($validated))
                ->withQueryString()
        );
    }

    public function store(Request $request, Location $location): JsonResponse
    {
        Gate::authorize('create', [RegistryImport::class, $location]);

        $validated = $request->validate([
            'file' => [
                'required',
                File::types(['csv', 'txt'])
                    ->max((int) config('wasiy.imports.max_file_kb', 2048)),
            ],
            'import_type' => ['required', Rule::enum(ImportType::class)],
        ]);

        /** @var User $user */
        $user = $request->user();
        $disk = config('wasiy.imports.disk', 'local');
        $file = $validated['file'];

        // Store the file before touching the database, keyed by a
        // pre-generated id: a storage failure must not strand a Pending
        // import row with no file behind it.
        $importId = (string) Str::ulid();

        $path = Storage::disk($disk)->putFileAs(
            "imports/{$location->account_id}/{$importId}",
            $file,
            $this->storedFilename($file->getClientOriginalName()),
        );

        try {
            $import = DB::transaction(function () use ($validated, $location, $user, $disk, $file, $path, $importId): RegistryImport {
                $import = new RegistryImport([
                    'account_id' => $location->account_id,
                    'location_id' => $location->id,
                    'requested_by_user_id' => $user->id,
                    'import_type' => $validated['import_type'],
                    'status' => ImportStatus::Pending,
                    'original_filename' => $file->getClientOriginalName(),
                    'disk' => $disk,
                    'path' => $path,
                    'total_rows' => 0,
                    'valid_rows' => 0,
                    'error_rows' => 0,
                    'duplicate_rows' => 0,
                    'warning_rows' => 0,
                ]);
                // id is deliberately not fillable; the pre-generated ULID
                // keys the already-stored file path.
                $import->id = $importId;
                $import->save();

                $this->activityLogger->log(
                    account: $location->account,
                    eventType: ActivityEventType::ImportUploaded,
                    summary: 'Importacion CSV cargada.',
                    metadata: $import->activityMetadata(),
                    location: $location,
                    actor: $user,
                    subjectType: RegistryImport::class,
                    subjectId: $import->id,
                );

                return $import;
            });
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);

            throw $exception;
        }

        ValidateRegistryImport::dispatch($import);

        return (new RegistryImportResource($import))->response()->setStatusCode(201);
    }

    public function show(RegistryImport $import): RegistryImportResource
    {
        Gate::authorize('view', $import);

        return new RegistryImportResource($import);
    }

    public function rows(Request $request, RegistryImport $import): AnonymousResourceCollection
    {
        Gate::authorize('view', $import);

        $validated = $request->validate([
            'status' => ['sometimes', 'nullable', Rule::enum(ImportRowStatus::class)],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            ...$this->paginationRules(),
        ]);

        $rows = RegistryImportRow::query()
            ->where('registry_import_id', $import->id)
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['search'] ?? null, fn (Builder $query, string $search) => $query->searchLike(
                ['raw_data::text', 'normalized_data::text', 'errors::text', 'warnings::text', "COALESCE(duplicate_key, '')"],
                $search,
            ));

        return RegistryImportRowResource::collection(
            $rows
                ->orderBy('row_number')
                ->paginate($this->perPage($validated))
                ->withQueryString()
        );
    }

    public function confirm(RegistryImport $import): RegistryImportResource
    {
        Gate::authorize('confirm', $import);

        $import->confirm();

        CommitRegistryImport::dispatch($import);

        return new RegistryImportResource($import->refresh());
    }

    public function retry(RegistryImport $import): RegistryImportResource
    {
        Gate::authorize('retry', $import);

        $import->retryValidation();

        ValidateRegistryImport::dispatch($import);

        return new RegistryImportResource($import->refresh());
    }

    private function storedFilename(string $originalFilename): string
    {
        $extension = pathinfo($originalFilename, PATHINFO_EXTENSION) ?: 'csv';
        $basename = pathinfo($originalFilename, PATHINFO_FILENAME);
        $slug = Str::slug($basename) ?: 'registro';

        return "{$slug}.{$extension}";
    }

}
