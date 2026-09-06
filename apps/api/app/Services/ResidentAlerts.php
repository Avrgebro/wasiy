<?php

namespace App\Services;

use App\Enums\RegistryStatus;
use App\Enums\ResidentAlertKind;
use App\Models\Announcement;
use App\Models\Location;
use App\Models\Package;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\ResidentAlert;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\Visit;
use App\Notifications\ResidentAlertNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
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

        $this->deliver($unit->location, $recipients->map(fn (Resident $resident) => [$resident, $unit->id]), $kind, $title, $body, $subject, $facts, $intro, $actionLabel, $actionPath, email: true);
    }

    /**
     * Location-wide fan-out (announcements): every active resident of every
     * active unit hears once, under their first unit. `$email` is the
     * location's "correo a residentes por anuncio nuevo" switch; a resident's
     * own family switch still applies on top.
     *
     * @param  array<int, array{label: string, value: string}>  $facts
     * @return array{recipients: int, alerts: int, emails: int}
     */
    public function broadcast(
        Location $location,
        ResidentAlertKind $kind,
        string $title,
        ?string $body,
        Model $subject,
        array $facts = [],
        ?string $intro = null,
        ?string $actionLabel = null,
        ?string $actionPath = null,
        bool $email = true,
    ): array {
        $location->loadMissing('account');

        $pairs = UnitMembership::query()
            ->where('location_id', $location->id)
            ->where('status', RegistryStatus::Active)
            ->whereHas('unit', fn ($unit) => $unit->where('status', RegistryStatus::Active->value))
            ->with('resident.user')
            ->orderBy('id')
            ->get()
            ->filter(fn (UnitMembership $membership) => $membership->resident !== null && $membership->resident->status === RegistryStatus::Active)
            ->unique(fn (UnitMembership $membership) => $membership->resident_id)
            ->map(fn (UnitMembership $membership) => [$membership->resident, $membership->unit_id])
            ->values();

        return $this->deliver($location, $pairs, $kind, $title, $body, $subject, $facts, $intro, $actionLabel, $actionPath, $email);
    }

    /**
     * @param  Collection<int, array{0: Resident, 1: string}>  $pairs  resident and the unit the alert files under
     * @param  array<int, array{label: string, value: string}>  $facts
     * @return array{recipients: int, alerts: int, emails: int}
     */
    private function deliver($location, $pairs, ResidentAlertKind $kind, string $title, ?string $body, Model $subject, array $facts, ?string $intro, ?string $actionLabel, ?string $actionPath, bool $email): array
    {
        $alerts = 0;
        $emails = 0;

        foreach ($pairs as [$resident, $unitId]) {
            $alert = null;

            if ($resident->user_id !== null) {
                $alert = ResidentAlert::query()->create([
                    'account_id' => $location->account_id,
                    'location_id' => $location->id,
                    'unit_id' => $unitId,
                    'resident_id' => $resident->id,
                    'kind' => $kind,
                    'title' => $title,
                    'body' => $body,
                    'subject_type' => match (true) {
                        $subject instanceof Reservation => 'reservation',
                        $subject instanceof Package => 'package',
                        $subject instanceof Visit => 'visit',
                        $subject instanceof Announcement => 'announcement',
                        default => null,
                    },
                    'subject_id' => $subject->getKey(),
                ]);
                $alerts++;
            }

            $address = $resident->user?->email ?: $resident->email;

            if ($email && $address && $resident->wantsEmailFor($kind->family())) {
                $notification = new ResidentAlertNotification(
                    locationName: $location->name,
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
                DB::afterCommit(fn () => Notification::route('mail', $address)->notify($notification));
                $emails++;
            }
        }

        return ['recipients' => count($pairs), 'alerts' => $alerts, 'emails' => $emails];
    }
}
