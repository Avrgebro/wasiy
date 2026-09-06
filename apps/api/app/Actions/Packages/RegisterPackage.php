<?php

namespace App\Actions\Packages;

use App\Enums\ActivityEventType;
use App\Enums\PackageStatus;
use App\Enums\ResidentAlertKind;
use App\Models\Package;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ResidentAlerts;
use Illuminate\Support\Facades\DB;

/**
 * Register an arrival and tell someone: the addressed resident when there is
 * one, otherwise the unit's primary contact. When neither has an email the
 * record says so (notified_email stays null) instead of failing.
 */
class RegisterPackage
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly ResidentAlerts $alerts,
    ) {}

    public function handle(Unit $unit, ?Resident $resident, User $actor, ?string $notes): Package
    {
        return DB::transaction(function () use ($unit, $resident, $actor, $notes): Package {
            $recipient = $resident ?? $unit->primaryContactMembership()->with('resident')->first()?->resident;
            $email = $recipient?->email ?: null;

            $package = new Package([
                'account_id' => $unit->account_id,
                'location_id' => $unit->location_id,
                'unit_id' => $unit->id,
                'resident_id' => $resident?->id,
                'notes' => $notes,
            ]);
            $package->forceFill([
                'status' => PackageStatus::Pending,
                'received_by' => $actor->id,
                'received_at' => now(),
                'notified_email' => $email,
            ])->save();

            // A named recipient hears alone; otherwise the whole unit does (P3).
            $this->alerts->send(
                unit: $unit,
                kind: ResidentAlertKind::PackageReceived,
                title: 'Paquete recibido',
                body: 'Recepción tiene un paquete para '.($resident ? $resident->first_name : 'tu unidad').($notes ? " · {$notes}" : '').'.',
                subject: $package,
                facts: array_values(array_filter([
                    ['label' => 'Unidad', 'value' => $unit->label()],
                    ['label' => 'Recibido', 'value' => $package->received_at->setTimezone($unit->location->timezone)->locale('es')->isoFormat('D [de] MMMM, HH:mm')],
                    $notes ? ['label' => 'Detalle', 'value' => $notes] : null,
                ])),
                intro: 'Recepción recibió un paquete y lo guarda hasta que lo retires con tu documento.',
                actionLabel: 'Ver paquetes',
                actionPath: '/portal',
                only: $resident,
            );

            $this->activityLogger->log(
                account: $unit->account,
                eventType: ActivityEventType::PackageReceived,
                summary: "Paquete recibido para la unidad {$unit->label()}.",
                metadata: [
                    'package_id' => $package->id,
                    'unit_id' => $unit->id,
                    'unit_label' => $unit->label(),
                    'resident_id' => $resident?->id,
                    'resident_name' => $resident?->name,
                    'notified_email' => $email,
                ],
                location: $unit->location,
                actor: $actor,
                subjectType: 'package',
                subjectId: $package->id,
            );

            return $package;
        });
    }
}
