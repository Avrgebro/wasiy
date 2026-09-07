<?php

return [
    'invitations' => [
        'staff_expires_days' => (int) env('WASIY_STAFF_INVITATION_EXPIRES_DAYS', 14),
        'resident_expires_days' => (int) env('WASIY_RESIDENT_INVITATION_EXPIRES_DAYS', 14),
        // Claim URLs must point at the SPA origin, not APP_URL. The API host
        // serves no page for these paths.
        'spa_url' => env('WASIY_SPA_URL', 'http://localhost:5174'),
        'resident_claim_url' => env(
            'WASIY_RESIDENT_INVITATION_CLAIM_URL',
            env('WASIY_SPA_URL', 'http://localhost:5174').'/invitations/resident/{token}',
        ),
        'staff_claim_url' => env(
            'WASIY_STAFF_INVITATION_CLAIM_URL',
            env('WASIY_SPA_URL', 'http://localhost:5174').'/invitations/staff/{token}',
        ),
    ],
    'marketing' => [
        // Public site the email logo and footer link to. Defaults to the local
        // Astro dev server; staging and production set their own host.
        'url' => env('WASIY_MARKETING_URL', 'http://localhost:4321'),
    ],
    'portal' => [
        // Where alert emails send residents (mockup 03d "Ver reserva").
        'url' => env('WASIY_PORTAL_URL', 'http://localhost:5175'),
    ],
    'alerts' => [
        // Read alerts older than this are pruned by alerts:prune.
        'retention_days' => (int) env('WASIY_ALERT_RETENTION_DAYS', 90),
    ],
    'leads' => [
        // Sales inbox that gets a heads-up for every marketing form submission.
        'notify_email' => env('WASIY_LEADS_NOTIFY_EMAIL', 'hola@wasiy.co'),
    ],
    'billing' => [
        // Manual payment instructions shown on the subscription page (ADR 0040).
        // Yape and Plin are channels into the same account, not payment
        // methods; unset numbers hide their card. Replaced by the payment
        // provider's button later.
        'transfer' => [
            'bank' => env('WASIY_BILLING_BANK', 'BCP'),
            'account_type' => env('WASIY_BILLING_ACCOUNT_TYPE', 'Cuenta corriente soles'),
            'account_number' => env('WASIY_BILLING_ACCOUNT_NUMBER'),
            'cci' => env('WASIY_BILLING_CCI'),
            'holder' => env('WASIY_BILLING_HOLDER', 'Wasiy SAC'),
            'tax_id' => env('WASIY_BILLING_TAX_ID'),
        ],
        'yape' => ['number' => env('WASIY_BILLING_YAPE_NUMBER'), 'holder' => env('WASIY_BILLING_HOLDER', 'Wasiy SAC')],
        'plin' => ['number' => env('WASIY_BILLING_PLIN_NUMBER'), 'holder' => env('WASIY_BILLING_HOLDER', 'Wasiy SAC')],
    ],
    'photos' => [
        'disk' => env('WASIY_PHOTO_DISK', 'local'),
        // JPG and PNG at up to 10 MB, per the dropzone contract in the
        // mockups; Laravel stays authoritative regardless of the dropzone.
        'max_file_kb' => (int) env('WASIY_PHOTO_MAX_FILE_KB', 10240),
        'max_per_owner' => (int) env('WASIY_PHOTO_MAX_PER_OWNER', 10),
    ],
];
