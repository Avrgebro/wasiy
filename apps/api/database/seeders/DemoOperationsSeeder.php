<?php

namespace Database\Seeders;

use App\Enums\ActivityEventType;
use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Enums\PackageStatus;
use App\Enums\RegistryStatus;
use App\Enums\ReservationStatus;
use App\Enums\ResidentAlertKind;
use App\Enums\VisitConfirmation;
use App\Enums\VisitStatus;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\Announcement;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Package;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\ResidentAlert;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Visit;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

/**
 * Volume for Edificio Central so every module and the Panel (mockups 17/17b)
 * read like a building in operation: two towers of units with fees, a
 * resident roster with primary contacts and portal states, this month's
 * dues in every state, a reception log of visits and packages, today's
 * reservations, and the activity entries the feeds read. Idempotent: rows
 * key on natural identifiers, so reseeding refreshes instead of duplicating.
 * Depends on DemoRegistrySeeder, DemoLocationsSeeder and DemoFinancesSeeder.
 */
class DemoOperationsSeeder extends Seeder
{
    use WithoutModelEvents;

    private Account $account;

    private Location $central;

    private User $admin;

    private User $manager;

    private User $desk;

    private CarbonImmutable $now;

    /** @var Collection<string, Unit> keyed by "Tower-number" */
    private Collection $units;

    public function run(): void
    {
        $this->account = Account::query()->where('slug', 'wasiy-demo')->sole();
        $this->central = Location::query()->where('slug', 'edificio-central')->sole();
        $this->admin = User::query()->where('email', 'admin@wasiy.test')->sole();
        $this->manager = User::query()->where('email', 'manager@wasiy.test')->sole();
        // The demo desk user is assigned to Torre Norte; the Central log still
        // needs a receptionist name on its rows.
        $this->desk = User::query()->where('email', 'frontdesk@wasiy.test')->sole();
        $this->now = CarbonImmutable::now($this->central->timezone);

        $this->units = $this->seedUnits();
        $residents = $this->seedResidents();
        $this->seedDues();
        $this->seedExpenses();
        $this->seedReservations($residents);
        $this->seedPackages($residents);
        $this->seedVisits($residents);
        $this->seedAlerts($residents);
        $this->seedAnnouncements($residents);
        $this->seedVehicles();
    }

    /**
     * Torre A floors 1–6 (two per floor) and Torre B floors 10–17 (two per
     * floor), plus one inactive and one commercial unit. The registry seeder's
     * 101/102/201/301 are kept as-is.
     *
     * @return Collection<string, Unit>
     */
    private function seedUnits(): Collection
    {
        $units = collect();
        $existing = Unit::query()->where('location_id', $this->central->id)->get()
            ->keyBy(fn (Unit $unit): string => $this->key($unit->building_name, $unit->unit_number));
        $units = $units->merge($existing);
        $takenNumbers = $existing->pluck('unit_number')->all();

        $specs = [];
        foreach (range(1, 6) as $floor) {
            foreach ([1, 2] as $side) {
                $specs[] = ['Torre A', "{$floor}0{$side}", $floor, $side === 1 ? 118 : 76, $side === 1 ? 42000 : 38000];
            }
        }
        // Torre B numbers from floor 10 so unit numbers stay unique per location.
        foreach (range(10, 17) as $floor) {
            foreach ([1, 2] as $side) {
                $specs[] = ['Torre B', "{$floor}0{$side}", $floor, $side === 1 ? 142 : 95, $side === 1 ? 52000 : 44000];
            }
        }

        foreach ($specs as [$tower, $number, $floor, $area, $fee]) {
            $key = $this->key($tower, $number);
            // 201 and 301 already exist in Torre B from the registry seeder.
            if ($units->has($key) || in_array($number, $takenNumbers, true)) {
                continue;
            }

            $units->put($key, Unit::query()->updateOrCreate(
                ['account_id' => $this->account->id, 'location_id' => $this->central->id, 'unit_number' => $number],
                [
                    'building_name' => $tower,
                    'floor' => (string) $floor,
                    'type' => 'apartment',
                    'participation_share' => round($area / 100, 2),
                    'maintenance_fee_minor' => $fee,
                    'parking_spots' => $floor % 2 === 0 ? 'E-'.(10 + $floor * 2 + ($number[-1] === '1' ? 0 : 1)) : null,
                    'storage_rooms' => $floor % 3 === 0 ? 'D-0'.$floor : null,
                    'status' => RegistryStatus::Active,
                    'notes' => null,
                ],
            ));
        }

        $units->put($this->key('Torre A', 'L-01'), Unit::query()->updateOrCreate(
            ['account_id' => $this->account->id, 'location_id' => $this->central->id, 'unit_number' => 'L-01'],
            ['building_name' => 'Torre A', 'floor' => '1', 'type' => 'commercial', 'participation_share' => 0.64, 'maintenance_fee_minor' => 35000, 'status' => RegistryStatus::Active, 'notes' => 'Local comercial · farmacia.'],
        ));

        return $units;
    }

    /**
     * Roughly two residents per occupied unit: a primary contact everywhere
     * except a handful of "attention" units, some with a portal user, some
     * with a pending invitation, most not yet invited.
     *
     * @return Collection<string, Resident> keyed by unit key, the primary contact of each unit
     */
    private function seedResidents(): Collection
    {
        $names = [
            ['Carlos', 'Mendoza'], ['Lucía', 'Ramírez'], ['Ana', 'Torres'], ['Patricia', 'Núñez'], ['Jorge', 'Peña'],
            ['Elena', 'Vargas'], ['Miguel', 'Castro'], ['Sofía', 'Herrera'], ['Diego', 'Flores'], ['Valeria', 'Chávez'],
            ['Andrés', 'Quispe'], ['Camila', 'Rojas'], ['Fernando', 'Díaz'], ['Gabriela', 'Salas'], ['Ricardo', 'Paredes'],
            ['Daniela', 'Vega'], ['Martín', 'Guerrero'], ['Paola', 'Medina'], ['Sebastián', 'Cárdenas'], ['Renata', 'Aguilar'],
            ['Álvaro', 'Ríos'], ['Mariana', 'Espinoza'], ['Javier', 'Soto'], ['Claudia', 'Ponce'], ['Bruno', 'Zapata'],
            ['Natalia', 'Campos'], ['Hugo', 'Ibáñez'], ['Isabel', 'Cornejo'], ['Rodrigo', 'Palacios'], ['Ximena', 'Luna'],
            ['Tomás', 'Bravo'], ['Alessandra', 'Miranda'], ['Gonzalo', 'Reyes'], ['Fiorella', 'Arce'], ['Emilio', 'Valdez'],
            ['Rocío', 'Benites'], ['Nicolás', 'Sánchez'], ['Adriana', 'Montoya'], ['Pablo', 'Ugarte'], ['Micaela', 'Delgado'],
        ];

        $primaries = collect();
        $nameIndex = 0;
        $skipped = ['Torre A-602', 'Torre B-1301', 'Torre B-1702']; // vacant units
        $noPrimary = ['Torre A-401', 'Torre B-1502']; // residents but nobody flagged as contact
        $withPortal = ['Torre A-202', 'Torre B-1001', 'Torre B-1101', 'Torre B-1601'];
        $index = 0;

        foreach ($this->units as $key => $unit) {
            $index++;
            if (in_array($key, ['Torre A-101', 'Torre A-102', 'Torre B-201', 'Torre B-301'], true)) {
                // Already populated by DemoRegistrySeeder (101/102/201 have residents; 301 is inactive).
                continue;
            }
            if ($unit->status !== RegistryStatus::Active || in_array($key, $skipped, true) || $unit->type === 'commercial') {
                continue;
            }

            $count = $index % 3 === 0 ? 1 : 2;
            for ($i = 0; $i < $count; $i++) {
                [$first, $last] = $names[$nameIndex % count($names)];
                $nameIndex++;
                $slug = strtolower($this->ascii("{$first}.{$last}"));
                $resident = Resident::query()->updateOrCreate(
                    ['account_id' => $this->account->id, 'email' => "{$slug}@demo.wasiy.test"],
                    [
                        'first_name' => $first,
                        'last_name' => $last,
                        'phone' => '+519'.str_pad((string) (10_000_000 + crc32($slug) % 89_999_999), 8, '0', STR_PAD_LEFT),
                        'status' => RegistryStatus::Active,
                    ],
                );

                $membership = UnitMembership::query()->updateOrCreate(
                    ['account_id' => $this->account->id, 'resident_id' => $resident->id, 'unit_id' => $unit->id],
                    [
                        'location_id' => $this->central->id,
                        'status' => RegistryStatus::Active,
                        'is_primary_contact' => false,
                        'started_at' => $this->now->subMonths(($index * 7) % 30 + 1)->toDateString(),
                        'ended_at' => null,
                    ],
                );

                if ($i === 0 && ! in_array($key, $noPrimary, true)) {
                    $membership->makeActivePrimaryContact();
                    $primaries->put($key, $resident);
                    if (in_array($key, $withPortal, true) && $resident->user_id === null) {
                        $user = User::query()->updateOrCreate(
                            ['email' => $resident->email],
                            ['first_name' => $first, 'last_name' => $last, 'email_verified_at' => now(), 'password' => bcrypt('password')],
                        );
                        $resident->forceFill(['user_id' => $user->id])->save();
                    }
                } elseif ($i === 0) {
                    $primaries->put($key, $resident);
                }
            }
        }

        // The registry seeder's units: keep their primaries reachable for logs.
        foreach (['Torre A-101', 'Torre A-102', 'Torre B-201'] as $key) {
            $unit = $this->units->get($key);
            $resident = $unit?->activeUnitMemberships()->with('resident')->first()?->resident;
            if ($resident) {
                $primaries->put($key, $resident);
            }
        }

        return $primaries;
    }

    /**
     * This month's maintenance dues for every active unit with a fee, mostly
     * paid, some pending, a couple overdue from last month.
     */
    private function seedDues(): void
    {
        $month = $this->now->format('Y-m');
        $previous = $this->now->subMonth();
        $label = $this->now->locale('es')->isoFormat('MMMM YYYY');
        $previousLabel = $previous->locale('es')->isoFormat('MMMM YYYY');
        $firstDay = $this->now->startOfMonth();

        $index = 0;
        $created = 0;
        foreach ($this->units as $unit) {
            if ($unit->status !== RegistryStatus::Active || ! $unit->maintenance_fee_minor) {
                continue;
            }
            $index++;
            $paid = $index % 4 !== 0; // 75 % collected

            $movement = FinancialMovement::query()->updateOrCreate(
                ['unit_id' => $unit->id, 'category' => MovementCategory::MaintenanceDues->value, 'period' => $month],
                [
                    'account_id' => $this->account->id,
                    'location_id' => $this->central->id,
                    'direction' => MovementDirection::Income,
                    'status' => $paid ? MovementStatus::Paid : MovementStatus::Pending,
                    'amount_minor' => $unit->maintenance_fee_minor,
                    'concept' => "Cuota de mantenimiento · {$label}",
                    'detail' => 'Emitida el '.$firstDay->locale('es')->isoFormat('DD MMM').' · '.$unit->label(),
                    'counterparty' => null,
                    'occurred_on' => $firstDay->toDateString(),
                    'due_on' => $firstDay->day(15)->toDateString(),
                    'created_by' => $this->admin->id,
                    'settled_by' => $paid ? $this->manager->id : null,
                    'settled_at' => $paid ? $firstDay->addDays(2 + $index % 12)->setTime(10, 0)->utc() : null,
                ],
            );
            $created++;
            $this->movementHistory($movement, $paid ? $firstDay->addDays(2 + $index % 12) : null);

            // Two units carry last month's dues unpaid as well.
            if ($index % 11 === 0) {
                $overdue = FinancialMovement::query()->updateOrCreate(
                    ['unit_id' => $unit->id, 'category' => MovementCategory::MaintenanceDues->value, 'period' => $previous->format('Y-m')],
                    [
                        'account_id' => $this->account->id,
                        'location_id' => $this->central->id,
                        'direction' => MovementDirection::Income,
                        'status' => MovementStatus::Pending,
                        'amount_minor' => $unit->maintenance_fee_minor,
                        'concept' => "Cuota de mantenimiento · {$previousLabel}",
                        'detail' => 'Emitida el '.$previous->startOfMonth()->locale('es')->isoFormat('DD MMM').' · '.$unit->label(),
                        'occurred_on' => $previous->startOfMonth()->toDateString(),
                        'due_on' => $previous->startOfMonth()->day(15)->toDateString(),
                        'created_by' => $this->admin->id,
                    ],
                );
                $this->movementHistory($overdue, null);
            }
        }

        $this->activity(ActivityEventType::DuesGenerated, "Se generaron {$created} cuotas de mantenimiento de {$label}.", $this->admin, $firstDay->setTime(8, 30), 'location', $this->central->id, ['period' => $month, 'created' => $created, 'skipped' => 0]);
    }

    private function seedExpenses(): void
    {
        $day = fn (int $day): string => $this->now->startOfMonth()->day(min($day, $this->now->daysInMonth))->toDateString();
        $rows = [
            [MovementCategory::Staff, MovementStatus::Paid, 480000, 'Vigilancia · turno completo', 'Factura F002-0918', 'Seguridad Andina SAC', $day(2)],
            [MovementCategory::Staff, MovementStatus::Paid, 320000, 'Planilla · conserjería', 'Quincena 1', null, $day(15)],
            [MovementCategory::Staff, MovementStatus::Pending, 45000, 'Jardinería · áreas verdes', 'Poda mensual', 'Verde Urbano', $day(18)],
            [MovementCategory::Services, MovementStatus::Paid, 18900, 'Internet · recepción', 'Recibo Movistar', 'Movistar', $day(9)],
            [MovementCategory::Maintenance, MovementStatus::Paid, 26000, 'Insumos de limpieza', 'Boleta B001-4410', 'Makro', $day(7)],
            [MovementCategory::Administration, MovementStatus::Pending, 135000, 'Seguro · áreas comunes', 'Cuota trimestral', 'Rímac Seguros', $day(25)],
        ];

        foreach ($rows as [$category, $status, $amount, $concept, $detail, $counterparty, $occurredOn]) {
            $movement = FinancialMovement::query()->updateOrCreate(
                ['location_id' => $this->central->id, 'concept' => $concept, 'occurred_on' => $occurredOn, 'detail' => $detail],
                [
                    'account_id' => $this->account->id,
                    'direction' => MovementDirection::Expense,
                    'category' => $category,
                    'status' => $status,
                    'amount_minor' => $amount,
                    'counterparty' => $counterparty,
                    'created_by' => $this->admin->id,
                    'settled_by' => $status === MovementStatus::Paid ? $this->admin->id : null,
                    'settled_at' => $status === MovementStatus::Paid ? CarbonImmutable::parse($occurredOn)->setTime(11, 0)->utc() : null,
                ],
            );
            $this->movementHistory($movement, $status === MovementStatus::Paid ? CarbonImmutable::parse($occurredOn, $this->central->timezone) : null);
        }
    }

    /**
     * @param  Collection<string, Resident>  $primaries
     */
    private function seedReservations(Collection $primaries): void
    {
        $amenities = Amenity::query()->where('location_id', $this->central->id)->get()->keyBy('slug');
        $eventRoom = $amenities->get('salon-de-eventos');
        $rooftop = $amenities->get('parrilla-terraza');
        $gym = $amenities->get('gimnasio');
        $squash = $amenities->get('cancha-de-squash');
        $today = $this->now->startOfDay();

        $rows = [
            // [amenity, unit key, day offset, status, fee, deposit]
            // Two approved parties in the salón today: the conflict the week board shows.
            [$eventRoom, 'Torre A-402', 0, ReservationStatus::Approved, 15000, 30000],
            [$rooftop, 'Torre B-1601', 0, ReservationStatus::Pending, 5000, null],
            [$gym, 'Torre A-202', 0, ReservationStatus::Approved, null, null],
            [$eventRoom, 'Torre B-1401', 0, ReservationStatus::Approved, 15000, 30000],
            [$squash, 'Torre B-1001', 1, ReservationStatus::Approved, null, null],
            [$eventRoom, 'Torre A-501', 2, ReservationStatus::Pending, 15000, 30000],
            [$rooftop, 'Torre B-1202', 3, ReservationStatus::Observed, 5000, null],
            [$eventRoom, 'Torre B-1501', -3, ReservationStatus::Approved, 15000, 30000],
            [$rooftop, 'Torre A-302', -6, ReservationStatus::Approved, 5000, null],
            [$eventRoom, 'Torre A-601', -9, ReservationStatus::Cancelled, 15000, 30000],
            [$gym, 'Torre B-201', -1, ReservationStatus::Rejected, null, null],
        ];

        foreach ($rows as [$amenity, $unitKey, $offset, $status, $fee, $deposit]) {
            $unit = $this->units->get($unitKey);
            if (! $amenity || ! $unit) {
                continue;
            }
            $resident = $primaries->get($unitKey);
            $day = $today->addDays($offset);
            // Preserve historical/future intent while finding an open day.
            for ($attempt = 0; $attempt < 7 && ! $amenity->isOpenOn($day); $attempt++) {
                $day = $day->addDays($offset < 0 ? -1 : 1);
            }
            if (! $amenity->isOpenOn($day)) {
                throw new \LogicException("No open day fits the demo reservation of {$amenity->name}.");
            }
            $decided = $status !== ReservationStatus::Pending;

            $reservation = Reservation::query()->updateOrCreate(
                ['amenity_id' => $amenity->id, 'unit_id' => $unit->id, 'reserved_on' => $day->toDateString()],
                [
                    'account_id' => $this->account->id,
                    'location_id' => $this->central->id,
                    'resident_id' => $resident?->id,
                    'status' => $status,
                    'status_note' => match ($status) {
                        ReservationStatus::Observed => 'Confirmar el número de invitados antes de aprobar.',
                        ReservationStatus::Rejected => 'El gimnasio abre a las 7:00.',
                        default => null,
                    },
                    'fee_snapshot_minor' => $fee,
                    'deposit_snapshot_minor' => $deposit,
                    'created_by' => $resident?->user_id ?? $this->manager->id,
                    'decided_by' => $decided ? $this->manager->id : null,
                    'decided_at' => $decided ? $day->subDays(2)->setTime(10, 15)->utc() : null,
                ],
            );

            $createdAt = $day->subDays(4)->setTime(9, 5);
            $this->activity(ActivityEventType::ReservationCreated, "Se solicitó {$amenity->name} para el ".$day->locale('es')->isoFormat('ddd D MMM').' · '.$unit->label().'.', $this->manager, $createdAt, 'reservation', $reservation->id, ['unit_id' => $unit->id]);
            if ($decided) {
                $eventType = match ($status) {
                    ReservationStatus::Approved => ActivityEventType::ReservationApproved,
                    ReservationStatus::Rejected => ActivityEventType::ReservationRejected,
                    ReservationStatus::Observed => ActivityEventType::ReservationObserved,
                    default => ActivityEventType::ReservationCancelled,
                };
                $verb = match ($status) {
                    ReservationStatus::Approved => 'Reserva aprobada',
                    ReservationStatus::Rejected => 'Reserva rechazada',
                    ReservationStatus::Observed => 'Reserva observada',
                    default => 'Reserva cancelada',
                };
                $this->activity($eventType, "{$verb} · {$amenity->name} · ".$unit->label().'.', $this->manager, $createdAt->addDays(2)->addHours(1), 'reservation', $reservation->id, ['unit_id' => $unit->id]);
            }
        }
    }

    /**
     * @param  Collection<string, Resident>  $primaries
     */
    private function seedPackages(Collection $primaries): void
    {
        $rows = [
            // [unit key, addressed to resident?, notes, days ago, hour, delivered?]
            ['Torre B-1302', true, 'Olva Courier · caja mediana', 5, 10, false],
            ['Torre A-101', true, 'Shalom · sobre documentos', 4, 16, false],
            ['Torre B-1602', true, 'Rappi · bolsa de farmacia', 2, 12, false],
            ['Torre A-302', false, 'Olva Courier · paquete pequeño', 1, 11, false],
            ['Torre B-1702', false, 'Scharff · caja grande, frágil', 0, 9, false],
            ['Torre A-502', true, 'Mercado Libre · caja pequeña', 0, 8, false],
            ['Torre B-1001', true, 'Amazon · sobre', 3, 15, true],
            ['Torre A-202', true, 'Urbano · caja mediana', 6, 9, true],
            ['Torre B-1401', false, 'Falabella · bolsa', 8, 13, true],
            ['Torre A-401', true, 'Olva Courier · dos cajas', 12, 10, true],
        ];

        foreach ($rows as [$unitKey, $toResident, $notes, $daysAgo, $hour, $delivered]) {
            $unit = $this->units->get($unitKey);
            if (! $unit) {
                continue;
            }
            $resident = $toResident ? $primaries->get($unitKey) : null;
            $receivedAt = $this->now->subDays($daysAgo)->setTime($hour, 40);
            $deliveredAt = $delivered ? $receivedAt->addHours(6 + $daysAgo) : null;

            $package = Package::query()->updateOrCreate(
                ['unit_id' => $unit->id, 'notes' => $notes, 'received_at' => $receivedAt->utc()],
                [
                    'account_id' => $this->account->id,
                    'location_id' => $this->central->id,
                    'resident_id' => $resident?->id,
                    'status' => $delivered ? PackageStatus::Delivered : PackageStatus::Pending,
                    'received_by' => $this->desk->id,
                    'delivered_by' => $delivered ? $this->desk->id : null,
                    'delivered_at' => $deliveredAt?->utc(),
                    'delivery_notes' => $delivered ? 'Entregado en recepción.' : null,
                    'notified_email' => $resident?->email ?? $primaries->get($unitKey)?->email,
                ],
            );

            $this->activity(ActivityEventType::PackageReceived, 'Paquete recibido · '.$unit->label().($resident ? " · {$resident->name}" : '').'.', $this->desk, $receivedAt, 'package', $package->id, ['unit_id' => $unit->id]);
            if ($deliveredAt) {
                $this->activity(ActivityEventType::PackageDelivered, 'Paquete entregado · '.$unit->label().'.', $this->desk, $deliveredAt, 'package', $package->id, ['unit_id' => $unit->id]);
            }
        }
    }

    /**
     * @param  Collection<string, Resident>  $primaries
     */
    private function seedVisits(Collection $primaries): void
    {
        $rows = [
            // [unit key, visitor, document, confirmation, minutes ago in, minutes ago out (null = inside), auto]
            ['Torre B-1102', 'Jorge Peña', '45678912', VisitConfirmation::Intercom, 13 * 60 + 5, null, false],
            ['Torre B-1502', 'Instaladora Claro', 'RUC 20100000001', VisitConfirmation::Management, 4 * 60 + 30, null, false],
            ['Torre A-402', 'Elena Vargas', '70123456', VisitConfirmation::Phone, 100, null, false],
            ['Torre A-101', 'Técnico Movistar', '41234567', VisitConfirmation::Intercom, 55, null, false],
            ['Torre B-1401', 'Delivery Rappi', null, VisitConfirmation::None, 12, null, false],
            ['Torre A-502', 'Rosa Quispe', '09876543', VisitConfirmation::Intercom, 6 * 60, 4 * 60 + 20, false],
            ['Torre B-301', 'Mario Benavides', '43219876', VisitConfirmation::Phone, 9 * 60, 7 * 60 + 10, false],
            ['Torre A-202', 'Gasfitero · Sr. Huamán', null, VisitConfirmation::Management, 26 * 60, 25 * 60, false],
            ['Torre B-1602', 'Sandra Loayza', '72345678', VisitConfirmation::Intercom, 30 * 60, 18 * 60, true],
            ['Torre A-302', 'Paquetería Urbano', null, VisitConfirmation::None, 50 * 60, 49 * 60 + 40, false],
            ['Torre B-1001', 'Familia Reyes (4)', null, VisitConfirmation::Intercom, 72 * 60, 68 * 60, false],
        ];

        foreach ($rows as [$unitKey, $visitor, $document, $confirmation, $inMinutes, $outMinutes, $auto]) {
            $unit = $this->units->get($unitKey);
            if (! $unit) {
                continue;
            }
            $checkedInAt = $this->now->subMinutes($inMinutes);
            $checkedOutAt = $outMinutes !== null ? $this->now->subMinutes($outMinutes) : null;
            $host = $primaries->get($unitKey);

            $visit = Visit::query()->updateOrCreate(
                ['unit_id' => $unit->id, 'visitor_name' => $visitor, 'checked_in_at' => $checkedInAt->utc()],
                [
                    'account_id' => $this->account->id,
                    'location_id' => $this->central->id,
                    'resident_id' => $host?->id,
                    'document' => $document,
                    'phone' => null,
                    'confirmation' => $confirmation,
                    'notes' => null,
                    'status' => $checkedOutAt ? VisitStatus::Left : VisitStatus::Inside,
                    'checked_in_by' => $this->desk->id,
                    'checked_out_by' => $checkedOutAt && ! $auto ? $this->desk->id : null,
                    'checked_out_at' => $checkedOutAt?->utc(),
                    'checkout_notes' => null,
                    'auto_checked_out' => $auto,
                ],
            );

            $this->activity(ActivityEventType::VisitCheckedIn, "Visita registrada · {$visitor} · ".$unit->label().'.', $this->desk, $checkedInAt, 'visit', $visit->id, ['unit_id' => $unit->id]);
            if ($checkedOutAt) {
                $this->activity(ActivityEventType::VisitCheckedOut, ($auto ? 'Salida automática' : 'Salida registrada')." · {$visitor} · ".$unit->label().'.', $auto ? null : $this->desk, $checkedOutAt, 'visit', $visit->id, ['unit_id' => $unit->id, 'automatic' => $auto]);
            }
        }

        // Portal pre-registrations for today (P1): the desk's "Esperados hoy" band.
        foreach ([['Torre A-402', 'Jorge Peña', '41290877', '19:00', 'Viene a recoger unas llaves. Puede subir directo.'], ['Torre A-402', 'Delivery Rappi', null, null, null], ['Torre B-1203', 'Marcela Ríos', '70882134', '11:30', null]] as [$unitKey, $visitor, $document, $time, $note]) {
            $unit = $this->units->get($unitKey);
            $host = $primaries->get($unitKey);
            if (! $unit || ! $host) {
                continue;
            }
            $visit = Visit::query()->updateOrCreate(
                ['unit_id' => $unit->id, 'visitor_name' => $visitor, 'expected_on' => $this->now->toDateString()],
                [
                    'account_id' => $this->account->id, 'location_id' => $this->central->id, 'resident_id' => $host->id,
                    'document' => $document, 'confirmation' => VisitConfirmation::PreRegistered, 'notes' => $note,
                    'status' => VisitStatus::Expected, 'expected_time' => $time, 'pre_registered_by' => $host->id,
                    'pre_registered_at' => $this->now->setTime(8, 12)->utc(), 'checked_in_by' => null, 'checked_in_at' => null,
                ],
            );
            $this->activity(ActivityEventType::VisitPreRegistered, "{$host->name} pre-registró a {$visitor} · ".$unit->label().'.', $host->user, $this->now->setTime(8, 12), 'visit', $visit->id, ['unit_id' => $unit->id]);
        }
    }

    /** Recorded, then paid when settled; skipped if the row already has history. */
    private function movementHistory(FinancialMovement $movement, ?CarbonImmutable $paidAt): void
    {
        if (ActivityLog::query()->where('subject_type', 'financial_movement')->where('subject_id', $movement->id)->exists()) {
            return;
        }
        $recordedAt = $movement->occurred_on->setTimezone($this->central->timezone)->setTime(8, 30);
        $this->activity(ActivityEventType::MovementRecorded, "Se registró un movimiento: {$movement->concept} (".Money::soles($movement->amount_minor).').', $this->admin, $recordedAt, 'financial_movement', $movement->id, ['status' => MovementStatus::Pending->value, 'unit_id' => $movement->unit_id]);
        if ($paidAt) {
            $this->activity(ActivityEventType::MovementStatusChanged, "El movimiento {$movement->concept} pasó de pending a paid.", $this->manager, $paidAt->setTime(10, 0), 'financial_movement', $movement->id, ['status' => 'paid', 'previous_status' => 'pending', 'unit_id' => $movement->unit_id]);
        }
    }

    /**
     * Portal P3 (mockup 03b): the portal residents open the bell to a few
     * unread alerts and some history. Idempotent on kind + title + time.
     *
     * @param  Collection<string, Resident>  $primaries
     */
    private function seedAlerts(Collection $primaries): void
    {
        $rows = [
            // [unit key, kind, title, body, hours ago, read?]
            ['Torre A-202', ResidentAlertKind::ReservationApproved, 'Tu reserva fue aprobada', 'Salón de eventos · sáb 12 sep', 2, false],
            ['Torre A-202', ResidentAlertKind::PackageReceived, 'Paquete recibido', 'Recepción tiene un paquete para tu unidad · Urbano · caja mediana.', 5, false],
            ['Torre A-202', ResidentAlertKind::VisitArrived, 'Visitante llegó', 'Jorge Peña ingresó a tu unidad.', 26, false],
            ['Torre A-202', ResidentAlertKind::ReservationObserved, 'Tu reserva fue observada', 'Parrilla · dom 13 sep · Confirmar el número de invitados antes de aprobar.', 30, true],
            ['Torre A-202', ResidentAlertKind::PackageDelivered, 'Paquete entregado', 'Tu paquete fue retirado de recepción.', 24 * 4, true],
            ['Torre B-1001', ResidentAlertKind::PackageDelivered, 'Paquete entregado', 'Tu paquete fue retirado de recepción. · Amazon · sobre', 24 * 3, false],
            ['Torre B-1001', ResidentAlertKind::VisitArrived, 'Visitante llegó', 'Delivery Rappi ingresó a tu unidad.', 24 * 6, true],
        ];

        foreach ($rows as [$unitKey, $kind, $title, $body, $hoursAgo, $read]) {
            $unit = $this->units->get($unitKey);
            $resident = $primaries->get($unitKey);
            if (! $unit || ! $resident || $resident->user_id === null) {
                continue;
            }
            $at = $this->now->subHours($hoursAgo);

            ResidentAlert::query()->updateOrCreate(
                ['resident_id' => $resident->id, 'kind' => $kind->value, 'title' => $title, 'created_at' => $at->utc()],
                [
                    'account_id' => $this->account->id,
                    'location_id' => $this->central->id,
                    'unit_id' => $unit->id,
                    'body' => $body,
                    'read_at' => $read ? $at->addHours(1)->utc() : null,
                    'updated_at' => $at->utc(),
                ],
            );
        }
    }

    /** Portal P4 (mockup 04): the portal units show a couple of cars. Idempotent on plate. */
    private function seedVehicles(): void
    {
        $rows = [
            ['Torre A-202', 'ABC-123', 'Toyota', 'Yaris', 'blanco'],
            ['Torre A-202', 'XYZ-789', 'Hyundai', 'Tucson', 'gris'],
            ['Torre B-1001', 'DEF-456', 'Kia', 'Sportage', 'negro'],
        ];

        foreach ($rows as [$unitKey, $plate, $make, $model, $color]) {
            $unit = $this->units->get($unitKey);
            if (! $unit) {
                continue;
            }

            Vehicle::query()->updateOrCreate(
                ['unit_id' => $unit->id, 'plate' => $plate],
                ['account_id' => $this->account->id, 'location_id' => $this->central->id, 'vehicle_type' => 'car', 'make' => $make, 'model' => $model, 'color' => $color, 'status' => 'active'],
            );
        }
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    /**
     * Mockup 18: two live posts (one important), one scheduled, one expired.
     *
     * @param  Collection<string, Resident>  $primaries
     */
    private function seedAnnouncements(Collection $primaries): void
    {
        $rows = [
            // [title, body, important, days ago published (null = scheduled in 2 days), expires in days from now]
            ['Corte de agua programado', "El martes cortaremos el agua de 09:00 a 13:00 para el mantenimiento anual de la cisterna.\n\nDurante esas horas no habrá servicio en ningún piso de ambas torres.\n\n- Almacenen agua la noche anterior.\n- No usen lavadoras ni lavavajillas.\n- El agua vuelve gradualmente desde el piso 1.", true, 1, 4],
            ['Mantenimiento de ascensores Torre B', "El ascensor 2 de Torre B estará fuera de servicio de lunes a miércoles por cambio de cables.\n\nEl ascensor 1 atenderá todos los pisos.", false, 3, 7],
            ['Nuevo horario de recepción', "Desde el 1 de septiembre recepción atiende de 7:00 a 23:00.\n\nFuera de ese horario, el intercomunicador deriva al servicio de vigilancia.", false, 8, null],
            ['Fumigación de áreas comunes', 'Se fumigarán jardines y estacionamientos durante la mañana. Eviten transitar por esas zonas hasta el mediodía.', false, null, null],
            ['Reglamento de piscina 2026', "Recuerden que el uso de la piscina es de 8:00 a 20:00 y los menores deben estar acompañados.\n\nEl reglamento completo está en recepción.", false, 40, -6],
        ];
        $residents = $primaries->count();

        foreach ($rows as [$title, $body, $important, $daysAgo, $expiresIn]) {
            $publishAt = $daysAgo === null ? $this->now->addDays(2)->setTime(8, 0) : $this->now->subDays($daysAgo)->setTime(18, 20);
            $announcement = Announcement::query()->updateOrCreate(
                ['location_id' => $this->central->id, 'title' => $title],
                [
                    'account_id' => $this->account->id,
                    'author_user_id' => $this->manager->id,
                    'body_md' => $body,
                    'excerpt' => Announcement::excerptOf($body),
                    'is_important' => $important,
                    'publish_at' => $publishAt->utc(),
                    'published_at' => $daysAgo === null ? null : $publishAt->utc(),
                    'expires_on' => $expiresIn === null ? null : $this->now->addDays($expiresIn)->toDateString(),
                    'notified_count' => $daysAgo === null ? 0 : $residents,
                    'emailed_count' => 0,
                ],
            );

            $this->activity(
                $daysAgo === null ? ActivityEventType::AnnouncementScheduled : ActivityEventType::AnnouncementPublished,
                ($daysAgo === null ? 'Anuncio programado: ' : 'Anuncio publicado: ')."«{$title}».",
                $this->manager,
                $daysAgo === null ? $this->now->subHours(5) : $publishAt,
                'announcement',
                $announcement->id,
                ['title' => $title],
            );
        }
    }

    private function activity(ActivityEventType $eventType, string $summary, ?User $actor, CarbonImmutable $at, string $subjectType, string $subjectId, array $metadata = []): void
    {
        ActivityLog::query()->updateOrCreate(
            ['subject_type' => $subjectType, 'subject_id' => $subjectId, 'event_type' => $eventType->value, 'created_at' => $at->utc()],
            [
                'account_id' => $this->account->id,
                'location_id' => $this->central->id,
                'actor_user_id' => $actor?->id,
                'summary' => $summary,
                'metadata' => $metadata,
            ],
        );
    }

    private function key(?string $tower, string $number): string
    {
        return ($tower ?? '').'-'.$number;
    }

    private function ascii(string $value): string
    {
        return strtr($value, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N']);
    }
}
