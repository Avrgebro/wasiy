# `/api/me` Permission Bootstrap

Wasiy will bootstrap frontend authentication and navigation state from an authenticated `/api/me` endpoint that returns the current user, account, assigned locations, roles, resident memberships, and related access context. Frontend route guards and menus are UX aids only; Laravel policies remain authoritative for authorization.
