<?php

namespace Database\Seeders;

use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
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
            // [direction, category, status, amount, concept, detail, counterparty, unit, occurred, due]
            [MovementDirection::Expense, MovementCategory::Utility, MovementStatus::Pending, 600,
                'Agua · áreas comunes', 'Recibo Sedapal', 'Sedapal', null, $day(16), $day(20)],
            [MovementDirection::Expense, MovementCategory::Utility, MovementStatus::Paid, 1180,
                'Luz · áreas comunes', 'Recibo Luz del Sur', 'Luz del Sur', null, $day(14), null],
            [MovementDirection::Expense, MovementCategory::Cleaning, MovementStatus::Paid, 1400,
                'Limpieza · quincena 1', 'Factura F001-2210', 'Limpieza Total SAC', null, $day(13), null],
            [MovementDirection::Expense, MovementCategory::Maintenance, MovementStatus::Paid, 600,
                'Mantenimiento · ascensor', 'Visita mensual', 'Ascensores Andinos', null, $day(6), null],
            [MovementDirection::Income, MovementCategory::ReservationFee, MovementStatus::Paid, 50,
                'Cuota · Parrilla / terraza', 'Reserva del vie, 19:00', null, '101', $day(14), null],
            [MovementDirection::Income, MovementCategory::ReservationFee, MovementStatus::Paid, 50,
                'Cuota · Parrilla / terraza', 'Reserva del lun, 13:00', null, '201', $day(11), null],
            [MovementDirection::Income, MovementCategory::ReservationFee, MovementStatus::Pending, 150,
                'Cuota · Salón de eventos', 'Reserva del sáb, 18:00', null, '102', $day(15), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::Pending, 300,
                'Depósito · Salón de eventos', 'Reserva del sáb, 18:00', null, '102', $day(15), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::ToRefund, 300,
                'Depósito · Salón de eventos', 'Evento del dom · sin incidencias', null, '301', $day(12), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::Held, 300,
                'Depósito · Salón de eventos', 'Evento del sáb · retenido durante el evento', null, '201', $day(8), null],
            [MovementDirection::Income, MovementCategory::ReservationDeposit, MovementStatus::Refunded, 300,
                'Depósito · Salón de eventos', 'Evento del dom 3 · devuelto', null, '101', $day(4), null],
        ];

        foreach ($rows as [$direction, $category, $status, $amount, $concept, $detail, $counterparty, $unitNumber, $occurredOn, $dueOn]) {
            $settled = $status !== MovementStatus::Pending;

            FinancialMovement::query()->updateOrCreate(
                ['location_id' => $central->id, 'concept' => $concept, 'occurred_on' => $occurredOn, 'detail' => $detail],
                [
                    'account_id' => $central->account_id,
                    'direction' => $direction,
                    'category' => $category,
                    'status' => $status,
                    'amount' => $amount,
                    'counterparty' => $counterparty,
                    'unit_id' => $unitNumber !== null ? $units->get($unitNumber)?->id : null,
                    'due_on' => $dueOn,
                    'created_by' => $admin->id,
                    'settled_by' => $settled ? $admin->id : null,
                    'settled_at' => $settled ? now() : null,
                ],
            );
        }
    }
}
