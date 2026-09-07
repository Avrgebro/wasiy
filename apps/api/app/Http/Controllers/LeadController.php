<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLeadRequest;
use App\Models\Lead;
use App\Notifications\LeadReceivedNotification;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;

class LeadController extends Controller
{
    /**
     * Public intake for the marketing forms. Always answers 202 so a bot
     * learns nothing from the response: honeypot hits are dropped silently
     * and the per-email cap counts as delivered.
     */
    public function store(StoreLeadRequest $request): Response
    {
        if ($request->isFromBot()) {
            return response()->noContent(202);
        }
        $data = $request->validated();
        $emailKey = 'leads-email:'.hash('sha256', $data['email']);
        if (RateLimiter::tooManyAttempts($emailKey, 3)) {
            return response()->noContent(202);
        }
        RateLimiter::hit($emailKey, 86400);

        DB::transaction(function () use ($request, $data): void {
            $lead = Lead::create([
                ...collect($data)->except(StoreLeadRequest::HONEYPOT)->all(),
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            ]);
            Notification::route('mail', config('wasiy.leads.notify_email'))->notify(new LeadReceivedNotification($lead));
        });

        return response()->noContent(202);
    }
}
