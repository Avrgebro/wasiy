<?php

use App\Models\Lead;
use App\Notifications\LeadReceivedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);
beforeEach(function () {
    Cache::flush();
    Notification::fake();
});
function contactInput(array $overrides = []): array
{
    return [...['source' => 'contacto', 'name' => 'María Torres', 'email' => 'Maria@Example.com', 'profile' => 'Junta de propietarios', 'units' => 86, 'message' => 'Se nos sale de las manos la parrilla.'], ...$overrides];
}

it('stores a contact lead and notifies the sales inbox', function () {
    config(['wasiy.leads.notify_email' => 'ventas@example.test']);
    $this->postJson('/api/public/leads', contactInput())->assertStatus(202);
    $lead = Lead::sole();
    expect($lead->email)->toBe('maria@example.com')->and($lead->units)->toBe(86)->and($lead->ip)->not->toBeNull();
    Notification::assertSentOnDemand(LeadReceivedNotification::class, function ($notification, $channels, $notifiable) use ($lead) {
        return $notification->lead->is($lead) && $notifiable->routes['mail'] === 'ventas@example.test';
    });
});
it('stores a demo request with ranges, interests and a slot', function () {
    $this->postJson('/api/public/leads', ['source' => 'demo', 'name' => 'Marco Delgado', 'email' => 'marco@horizonte.pe', 'phone' => '+51 999 999 999', 'organization' => 'Administradora Horizonte', 'units_range' => '51-200', 'interests' => ['Visitas', 'Reservas'], 'preferred_slot' => 'tarde'])->assertStatus(202);
    $lead = Lead::sole();
    expect($lead->source)->toBe('demo')->and($lead->interests)->toBe(['Visitas', 'Reservas'])->and($lead->units_range)->toBe('51-200');
});
it('silently drops submissions that fill the honeypot', function () {
    $this->postJson('/api/public/leads', contactInput(['website' => 'https://spam.example']))->assertStatus(202);
    expect(Lead::count())->toBe(0);
    Notification::assertNothingSent();
});
it('rejects invalid input', function () {
    $this->postJson('/api/public/leads', contactInput(['email' => 'maria@example']))->assertUnprocessable()->assertJsonValidationErrors('email');
    $this->postJson('/api/public/leads', contactInput(['name' => 'Buy now https://spam.example']))->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson('/api/public/leads', contactInput(['source' => 'newsletter']))->assertUnprocessable()->assertJsonValidationErrors('source');
    expect(Lead::count())->toBe(0);
});
it('caps submissions per email and per ip', function () {
    foreach (range(1, 3) as $i) {
        $this->postJson('/api/public/leads', contactInput())->assertStatus(202);
    }
    $this->postJson('/api/public/leads', contactInput())->assertStatus(202);
    expect(Lead::count())->toBe(3);
    $this->postJson('/api/public/leads', contactInput(['email' => 'otra@example.com']))->assertStatus(202);
    $this->postJson('/api/public/leads', contactInput(['email' => 'tercera@example.com']))->assertTooManyRequests();
});
