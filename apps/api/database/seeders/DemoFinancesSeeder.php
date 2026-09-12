<?php

namespace Database\Seeders;

use App\Actions\Finances\MovementMetadata;
use App\Enums\ActivityEventType;
use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Models\ActivityLog;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * M8 demo data: the month view from mockup 10 for Edificio Central — paid
 * and pending building expenses, collected and pending fees, and a deposit
 * in each stage of its lifecycle. Dates are relative to the current month
 * so the default view is never empty.
 */
class DemoFinancesSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $central = Location::query()->where('slug', 'edificio-central')->sole();
        $admin = User::query()->where('email', 'admin@wasiy.test')->sole();
        $units = Unit::query()->where('location_id', $central->id)->orderBy('unit_number')
            ->get()->keyBy('unit_number');

        $month = CarbonImmutable::now($central->timezone)->startOfMonth();
        $day = fn (int $day): string => $month->day(min($day, $month->daysInMonth))->toDateString();

        $rows = [
            // [direction, category, status, amount_minor, concept, detail, counterparty, unit, occurred, due]
            [MovementDirection::Expense, MovementCategory::Water, MovementStatus::Pending, 60000,
                'Agua · áreas comunes', 'Recibo Sedapal', 'Sedapal', null, $day(16), $day(20)],
            [MovementDirection::Expense, MovementCategory::Electricity, MovementStatus::Paid, 118000,
                'Luz · áreas comunes', 'Recibo Luz del Sur', 'Luz del Sur', null, $day(14), null],
            [MovementDirection::Expense, MovementCategory::Cleaning, MovementStatus::Paid, 140000,
                'Limpieza · quincena 1', 'Factura F001-2210', 'Limpieza Total SAC', null, $day(13), null],
            [MovementDirection::Expense, MovementCategory::Maintenance, MovementStatus::Paid, 60000,
                'Mantenimiento · ascensor', 'Visita mensual', 'Ascensores Andinos', null, $day(6), null],
            [MovementDirection::Income, MovementCategory::ReservationFee, MovementStatus::Paid, 5000,
                'Cuota · Parrilla / terraza', 'Reserva del vie, 19:00', null, '101', $day(14), null],
            [MovementDirection::Income, MovementCategory::ReservationFee, MovementStatus::Paid, 5000,
                'Cuota · Parrilla / terraza', 'Reserva del lun, 13:00', null, '201', $day(11), null],
            [MovementDirection::Income, MovementCategory::Fine, MovementStatus::Pending, 8000,
                'Multa · ruido fuera de horario', 'Reporte del lun, 23:40', null, '301', $day(11), null],
            [MovementDirection::Income, MovementCategory::MaintenanceDues, MovementStatus::Paid, 42000,
                'Cuota de mantenimiento · agosto', 'Pago en efectivo', null, '101', $day(5), null],
            [MovementDirection::Income, MovementCategory::ReservationFee, MovementStatus::Pending, 15000,
                'Cuota · Salón de eventos', 'Reserva del sáb, 18:00', null, '102', $day(15), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::Pending, 30000,
                'Depósito · Salón de eventos', 'Reserva del sáb, 18:00', null, '102', $day(15), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::Held, 30000,
                'Depósito · Salón de eventos', 'Evento del dom · sin incidencias', null, '301', $day(12), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::Held, 30000,
                'Depósito · Salón de eventos', 'Evento del sáb · retenido durante el evento', null, '201', $day(8), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::Refunded, 30000,
                'Depósito · Salón de eventos', 'Evento del dom 3 · devuelto', null, '101', $day(4), null],
        ];

        foreach ($rows as [$direction, $category, $status, $amount, $concept, $detail, $counterparty, $unitNumber, $occurredOn, $dueOn]) {
            $settled = $status !== MovementStatus::Pending;

            $movement = FinancialMovement::query()->updateOrCreate(
                ['location_id' => $central->id, 'concept' => $concept, 'occurred_on' => $occurredOn, 'detail' => $detail],
                [
                    'account_id' => $central->account_id,
                    'direction' => $direction,
                    'category' => $category,
                    'status' => $status,
                    'amount_minor' => $amount,
                    'counterparty' => $counterparty,
                    'unit_id' => $unitNumber !== null ? $units->get($unitNumber)?->id : null,
                    'due_on' => $dueOn,
                    'created_by' => $admin->id,
                    'settled_by' => $settled ? $admin->id : null,
                    'settled_at' => $settled ? now() : null,
                ],
            );

            $this->history($movement, $admin);
        }
    }

    /**
     * The drawer's timeline reads the activity log, which direct inserts
     * skip. Write the steps a real row would have gone through: recorded,
     * then (for deposits past pending) received, then the final status.
     */
    private function history(FinancialMovement $movement, User $actor): void
    {
        if (ActivityLog::query()->where('subject_type', 'financial_movement')->where('subject_id', $movement->id)->exists()) {
            return;
        }

        $at = $movement->occurred_on->setTimezone($movement->location->timezone)->setTime(9, 0);
        $fromReservation = $movement->category->isDeposit() || $movement->category === MovementCategory::ReservationFee;

        $steps = [[ActivityEventType::MovementRecorded, MovementStatus::Pending, null,
            $fromReservation ? "Se generó el movimiento {$movement->concept} al aprobar la reserva." : "Se registró un movimiento: {$movement->concept} (".Money::soles($movement->amount_minor).').']];

        $path = match ($movement->status) {
            MovementStatus::Pending => [],
            MovementStatus::Refunded, MovementStatus::Retained => [MovementStatus::Held, $movement->status],
            default => [$movement->status],
        };
        $previous = MovementStatus::Pending;
        foreach (array_unique($path, SORT_REGULAR) as $status) {
            $steps[] = [ActivityEventType::MovementStatusChanged, $status, $previous,
                "El movimiento {$movement->concept} pasó de {$previous->value} a {$status->value}."];
            $previous = $status;
        }

        foreach ($steps as $index => [$eventType, $status, $previousStatus, $summary]) {
            $snapshot = clone $movement;
            $snapshot->status = $status;

            ActivityLog::query()->create([
                'account_id' => $movement->account_id,
                'location_id' => $movement->location_id,
                'actor_user_id' => $actor->id,
                'subject_type' => 'financial_movement',
                'subject_id' => $movement->id,
                'event_type' => $eventType,
                'summary' => $summary,
                'metadata' => MovementMetadata::for($snapshot, $previousStatus?->value),
                'created_at' => $at->addDays($index)->addMinutes(14 * $index)->utc(),
            ]);
        }
    }
}
