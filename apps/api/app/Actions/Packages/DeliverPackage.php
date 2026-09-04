<?php

namespace App\Actions\Packages;

use App\Enums\ActivityEventType;
use App\Enums\PackageStatus;
use App\Models\Package;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Validation\ValidationException;

/** One way: pending → delivered. A mistake is fixed by registering again. */
class DeliverPackage
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Package $package, User $actor, ?string $deliveredTo): Package
    {
        if ($package->status !== PackageStatus::Pending) {
            throw ValidationException::withMessages([
                'status' => __('This package was already delivered.'),
            ]);
        }

        $package->forceFill([
            'status' => PackageStatus::Delivered,
            'delivered_by' => $actor->id,
            'delivered_at' => now(),
            'delivered_to' => $deliveredTo,
        ])->save();

        $package->loadMissing(['unit', 'location', 'account']);

        $this->activityLogger->log(
            account: $package->account,
            eventType: ActivityEventType::PackageDelivered,
            summary: "Paquete de la unidad {$package->unit->label()} entregado".($deliveredTo ? " a {$deliveredTo}" : '').'.',
            metadata: [
                'package_id' => $package->id,
                'unit_id' => $package->unit_id,
                'unit_label' => $package->unit->label(),
                'delivered_to' => $deliveredTo,
            ],
            location: $package->location,
            actor: $actor,
            subjectType: 'package',
            subjectId: $package->id,
        );

        return $package;
    }
}
