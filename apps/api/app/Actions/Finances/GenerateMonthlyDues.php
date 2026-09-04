<?php

namespace App\Actions\Finances;

use App\Enums\ActivityEventType;
use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\RegistryStatus;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Services\ActivityLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * "Generar cuotas del mes": one pending maintenance_dues movement per active
 * unit with a fee, dated the first of the month. Idempotent per unit and
 * month through the (unit_id, category, period) unique index, so running it
 * twice — or after adding a unit — only fills the gaps.
 */
class GenerateMonthlyDues
{
    public function __construct(
        private readonly RecordMovement $record,
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @return array{created: int, skipped: int}
     */
    public function handle(Location $location, User $actor, string $month): array
    {
        $firstDay = CarbonImmutable::createFromFormat('Y-m-d', "{$month}-01");
        $label = $firstDay->locale('es')->isoFormat('MMMM YYYY');

        return DB::transaction(function () use ($location, $actor, $month, $firstDay, $label): array {
            $units = Unit::query()
                ->where('location_id', $location->id)
                ->where('status', RegistryStatus::Active->value)
                ->where('maintenance_fee', '>', 0)
                ->orderBy('building_name')->orderBy('unit_number')
                ->get();

            $issued = FinancialMovement::query()
                ->where('location_id', $location->id)
                ->where('category', MovementCategory::MaintenanceDues->value)
                ->where('period', $month)
                ->pluck('unit_id')
                ->all();

            $created = 0;
            foreach ($units as $unit) {
                if (in_array($unit->id, $issued, true)) {
                    continue;
                }

                $this->record->handle($location, $actor, [
                    'direction' => MovementDirection::Income,
                    'category' => MovementCategory::MaintenanceDues,
                    'amount' => $unit->maintenance_fee,
                    'concept' => "Cuota de mantenimiento · {$label}",
                    'detail' => 'Emitida el '.$firstDay->locale('es')->isoFormat('DD MMM').' · '.$unit->label(),
                    'unit_id' => $unit->id,
                    'occurred_on' => $firstDay->toDateString(),
                    'period' => $month,
                ]);
                $created++;
            }

            $skipped = $units->count() - $created;

            $this->activityLogger->log(
                account: $location->account,
                eventType: ActivityEventType::DuesGenerated,
                summary: "Se generaron {$created} cuotas de mantenimiento de {$label}.",
                metadata: ['period' => $month, 'created' => $created, 'skipped' => $skipped],
                location: $location,
                actor: $actor,
                subjectType: 'location',
                subjectId: $location->id,
            );

            return ['created' => $created, 'skipped' => $skipped];
        });
    }
}
