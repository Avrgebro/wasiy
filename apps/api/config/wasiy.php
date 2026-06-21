<?php

return [
    'invitations' => [
        'staff_expires_days' => (int) env('WASIY_STAFF_INVITATION_EXPIRES_DAYS', 14),
        'resident_expires_days' => (int) env('WASIY_RESIDENT_INVITATION_EXPIRES_DAYS', 14),
        'resident_claim_url' => env('WASIY_RESIDENT_INVITATION_CLAIM_URL', env('APP_URL', 'http://localhost').'/resident-invitations/{token}'),
    ],
    'exports' => [
        'disk' => env('WASIY_EXPORT_DISK', 'local'),
        'expires_days' => (int) env('WASIY_EXPORT_EXPIRES_DAYS', 7),
    ],
    'imports' => [
        'disk' => env('WASIY_IMPORT_DISK', 'local'),
        'max_file_kb' => (int) env('WASIY_IMPORT_MAX_FILE_KB', 2048),
        'max_rows' => (int) env('WASIY_IMPORT_MAX_ROWS', 5000),
    ],
];
