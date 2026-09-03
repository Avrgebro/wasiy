<?php

namespace App\Actions\Finances;

use App\Enums\ActivityEventType;
use App\Enums\MovementStatus;
use App\Models\FinancialMovement;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Validation\ValidationException;

/**
 * Every status change goes through here so the machine in MovementStatus
 * is the only authority and every change is audited.
 */
class TransitionMovement
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(FinancialMovement $movement, User $actor, MovementStatus $target, ?string $note = null): FinancialMovement
    {
        if (! $movement->status->canTransitionTo($target, $movement->category)) {
            throw ValidationException::withMessages([
                'status' => __('This movement cannot move to that status.'),
            ]);
        }

        $previous = $movement->status->value;

        $movement->forceFill([
            'status' => $target,
            'note' => $note ?? $movement->note,
            'settled_by' => $actor->id,
            'settled_at' => now(),
        ])->save();

        $this->activityLogger->log(
            account: $movement->account,
            eventType: ActivityEventType::MovementStatusChanged,
            summary: "El movimiento {$movement->concept} pasó de {$previous} a {$target->value}.",
            metadata: MovementMetadata::for($movement, $previous),
            location: $movement->location,
            actor: $actor,
            subjectType: 'financial_movement',
            subjectId: $movement->id,
        );

        return $movement;
    }
}
