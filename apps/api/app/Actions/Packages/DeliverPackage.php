<?php

namespace App\Actions\Packages;

use App\Enums\ActivityEventType;
use App\Enums\PackageStatus;
use App\Enums\ResidentAlertKind;
use App\Models\Package;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ResidentAlerts;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** One way: pending → delivered. A mistake is fixed by registering again. */
class DeliverPackage
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly ResidentAlerts $alerts,
    ) {}

    public function handle(Package $package, User $actor, ?string $deliveryNotes): Package
    {
        if ($package->status !== PackageStatus::Pending) {
            throw ValidationException::withMessages([
                'status' => __('This package was already delivered.'),
            ]);
        }

        return DB::transaction(fn () => $this->deliver($package, $actor, $deliveryNotes));
    }

    private function deliver(Package $package, User $actor, ?string $deliveryNotes): Package
    {
        $package->forceFill([
            'status' => PackageStatus::Delivered,
            'delivered_by' => $actor->id,
            'delivered_at' => now(),
            'delivery_notes' => $deliveryNotes,
        ])->save();

        $package->loadMissing(['unit', 'location', 'account']);

        $this->activityLogger->log(
            account: $package->account,
            eventType: ActivityEventType::PackageDelivered,
            summary: "Paquete de la unidad {$package->unit->label()} entregado.",
            metadata: [
                'package_id' => $package->id,
                'unit_id' => $package->unit_id,
                'unit_label' => $package->unit->label(),
                'delivery_notes' => $deliveryNotes,
            ],
            location: $package->location,
            actor: $actor,
            subjectType: 'package',
            subjectId: $package->id,
        );

        $this->alerts->send(
            unit: $package->unit,
            kind: ResidentAlertKind::PackageDelivered,
            title: 'Paquete entregado',
            body: 'Tu paquete fue retirado de recepción.'.($deliveryNotes ? " · {$deliveryNotes}" : ''),
            subject: $package,
            facts: array_values(array_filter([
                ['label' => 'Unidad', 'value' => $package->unit->label()],
                ['label' => 'Entregado', 'value' => $package->delivered_at->setTimezone($package->location->timezone)->locale('es')->isoFormat('D [de] MMMM, HH:mm')],
                $deliveryNotes ? ['label' => 'Detalle', 'value' => $deliveryNotes] : null,
            ])),
            intro: 'Recepción entregó el paquete que guardaba para tu unidad.',
            actionLabel: 'Ver paquetes',
            actionPath: '/portal',
            only: $package->resident,
        );

        return $package;
    }
}
