<?php

namespace App\Services;

use App\Enums\RegistryStatus;
use App\Enums\ResidentAlertKind;
use App\Models\Package;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\ResidentAlert;
use App\Models\Unit;
use App\Models\Visit;
use App\Notifications\ResidentAlertNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Fan-out for portal alerts (P3). Every active member of the unit gets a
 * row they can read in the portal; those who kept the family's email switch
 * on also get the branded mail. A named recipient ($only) narrows both to
 * that one person, e.g. a package addressed to Laura is not Carlos's news.
 *
 * Emails go to the login address when the person has one, and to the
 * registry email otherwise, so a primary contact without portal access
 * still hears about packages, as before P3.
 */
class ResidentAlerts
{
    private const FAMILY_LABELS = ['reservations' => 'reservas', 'packages' => 'paquetes', 'visitors' => 'visitantes', 'announcements' => 'anuncios'];

    /**
     * @param  array<int, array{label: string, value: string}>  $facts
     */
    public function send(
        Unit $unit,
        ResidentAlertKind $kind,
        string $title,
        ?string $body,
        Model $subject,
        array $facts = [],
        ?string $intro = null,
        ?string $actionLabel = null,
        ?string $actionPath = null,
        ?Resident $only = null,
    ): void {
        $unit->loadMissing(['location', 'account']);

        $recipients = $only !== null
            ? collect([$only->loadMissing('user')])
            : $unit->unitMemberships()
                ->where('status', RegistryStatus::Active)
                ->with('resident.user')
                ->get()
                ->map(fn ($membership) => $membership->resident)
                ->filter(fn (?Resident $resident) => $resident !== null && $resident->status === RegistryStatus::Active)
                ->unique('id')
                ->values();

        foreach ($recipients as $resident) {
            $alert = null;

            if ($resident->user_id !== null) {
                $alert = ResidentAlert::query()->create([
                    'account_id' => $unit->account_id,
                    'location_id' => $unit->location_id,
                    'unit_id' => $unit->id,
                    'resident_id' => $resident->id,
                    'kind' => $kind,
                    'title' => $title,
                    'body' => $body,
                    'subject_type' => match (true) {
                        $subject instanceof Reservation => 'reservation',
                        $subject instanceof Package => 'package',
                        $subject instanceof Visit => 'visit',
                        default => null,
                    },
                    'subject_id' => $subject->getKey(),
                ]);
            }

            $email = $resident->user?->email ?: $resident->email;

            if ($email && $resident->wantsEmailFor($kind->family())) {
                $notification = new ResidentAlertNotification(
                    locationName: $unit->location->name,
                    recipientName: $resident->first_name,
                    title: $title,
                    intro: $intro,
                    body: $body,
                    facts: $facts,
                    footnote: 'Recibes este correo porque activaste las alertas de '.self::FAMILY_LABELS[$kind->family()->value].'. Cámbialo en Perfil.',
                    actionLabel: $actionLabel,
                    actionUrl: $actionPath !== null ? rtrim((string) config('wasiy.portal.url'), '/').$actionPath : null,
                    alertId: $alert?->id,
                );
                DB::afterCommit(fn () => Notification::route('mail', $email)->notify($notification));
            }
        }
    }
}
