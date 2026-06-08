# Sanctum Cookie Auth for SPA

Wasiy will use Laravel Sanctum cookie-based authentication for the Vite SPA in v1. This keeps browser authentication session-based with CSRF protection, avoids storing bearer tokens in localStorage, and keeps authorization close to the Account, Location, role, and Unit Membership model owned by the Laravel API.
