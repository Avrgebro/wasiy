<?php

namespace App\Jobs;

use App\Enums\ActivityEventType;
use App\Enums\ExportStatus;
use App\Enums\ExportType;
use App\Models\RegistryExport;
use App\Models\Unit;
use App\Models\Vehicle;
use App\Services\ActivityLogger;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

class GenerateCsvExport implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly RegistryExport $export,
    ) {}

    public function handle(?ActivityLogger $activityLogger = null): void
    {
        $activityLogger ??= app(ActivityLogger::class);

        $export = $this->export->fresh(['account', 'location', 'requestedBy']);

        if (! $export || $export->status !== ExportStatus::Pending) {
            return;
        }

        $export->forceFill([
            'status' => ExportStatus::Processing,
            'failure_reason' => null,
            'failed_at' => null,
        ])->save();

        try {
            $csv = match ($export->export_type) {
                ExportType::RegistryUnitsResidents => $this->registryUnitsResidentsCsv($export),
                ExportType::Vehicles => $this->vehiclesCsv($export),
            };

            $disk = $export->disk ?: config('wasiy.exports.disk', 'local');
            $path = 'exports/'.$export->account_id.'/'.$export->id.'/'.$export->filename;

            Storage::disk($disk)->put($path, $csv);

            $export->forceFill([
                'status' => ExportStatus::Ready,
                'disk' => $disk,
                'path' => $path,
                'completed_at' => now(),
                'failed_at' => null,
                'failure_reason' => null,
            ])->save();

            $activityLogger->log(
                account: $export->account,
                eventType: ActivityEventType::ExportCompleted,
                summary: 'Exportacion CSV completada.',
                metadata: [
                    'export_id' => $export->id,
                    'export_type' => $export->export_type->value,
                    'filename' => $export->filename,
                    'path' => $path,
                ],
                location: $export->location,
                actor: $export->requestedBy,
                subjectType: RegistryExport::class,
                subjectId: $export->id,
            );
        } catch (Throwable $exception) {
            $export->forceFill([
                'status' => ExportStatus::Failed,
                'failed_at' => now(),
                'failure_reason' => $exception->getMessage(),
            ])->save();

            $activityLogger->log(
                account: $export->account,
                eventType: ActivityEventType::ExportFailed,
                summary: 'Exportacion CSV fallida.',
                metadata: [
                    'export_id' => $export->id,
                    'export_type' => $export->export_type->value,
                    'failure_reason' => $exception->getMessage(),
                ],
                location: $export->location,
                actor: $export->requestedBy,
                subjectType: RegistryExport::class,
                subjectId: $export->id,
            );
        }
    }

    private function registryUnitsResidentsCsv(RegistryExport $export): string
    {
        $rows = [[
            'Unidad',
            'Edificio',
            'Piso',
            'Estado de unidad',
            'Residente',
            'Tipo de residente',
            'Contacto principal',
            'Estado de membresia',
            'Telefono',
            'Email',
        ]];

        $units = Unit::query()
            ->where('account_id', $export->account_id)
            ->when($export->location_id, fn (Builder $query, string $locationId) => $query->where('location_id', $locationId))
            ->when($export->filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->with(['unitMemberships.resident'])
            ->orderBy('building_name')
            ->orderBy('floor')
            ->orderBy('unit_number')
            ->get();

        foreach ($units as $unit) {
            if ($unit->unitMemberships->isEmpty()) {
                $rows[] = [
                    $unit->unit_number,
                    $unit->building_name,
                    $unit->floor,
                    $unit->status->value,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                ];

                continue;
            }

            foreach ($unit->unitMemberships as $membership) {
                $resident = $membership->resident;

                $rows[] = [
                    $unit->unit_number,
                    $unit->building_name,
                    $unit->floor,
                    $unit->status->value,
                    trim($resident->first_name.' '.$resident->last_name),
                    $membership->resident_type->value,
                    $membership->is_primary_contact ? 'Si' : 'No',
                    $membership->status->value,
                    $resident->phone,
                    $resident->email,
                ];
            }
        }

        return $this->toCsv($rows);
    }

    private function vehiclesCsv(RegistryExport $export): string
    {
        $rows = [[
            'Placa',
            'Tipo',
            'Unidad',
            'Edificio',
            'Piso',
            'Color',
            'Marca',
            'Modelo',
            'Estado',
        ]];

        $vehicles = Vehicle::query()
            ->where('account_id', $export->account_id)
            ->when($export->location_id, fn (Builder $query, string $locationId) => $query->where('location_id', $locationId))
            ->when($export->filters['unit_id'] ?? null, fn (Builder $query, string $unitId) => $query->where('unit_id', $unitId))
            ->when($export->filters['vehicle_type'] ?? null, fn (Builder $query, string $type) => $query->where('vehicle_type', $type))
            ->when($export->filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($export->filters['plate'] ?? null, fn (Builder $query, string $plate) => $query->whereRaw('LOWER(plate) = ?', [strtolower(trim($plate))]))
            ->with('unit')
            ->orderBy('plate')
            ->orderBy('id')
            ->get();

        foreach ($vehicles as $vehicle) {
            $rows[] = [
                $vehicle->plate,
                $vehicle->vehicle_type->value,
                $vehicle->unit->unit_number,
                $vehicle->unit->building_name,
                $vehicle->unit->floor,
                $vehicle->color,
                $vehicle->make,
                $vehicle->model,
                $vehicle->status->value,
            ];
        }

        return $this->toCsv($rows);
    }

    /**
     * @param  array<int, array<int, mixed>>  $rows
     */
    private function toCsv(array $rows): string
    {
        $handle = fopen('php://temp', 'r+');

        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }

        rewind($handle);

        $csv = stream_get_contents($handle);

        fclose($handle);

        return $csv === false ? '' : $csv;
    }
}
