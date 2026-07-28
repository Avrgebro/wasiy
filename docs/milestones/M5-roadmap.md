# M5 Roadmap: Sequential Invitation and Account Activation

## Goal

M5 makes invitations behave the same way for every kind of user: an invitation is sent, the recipient opens it, accepts it, and only at that moment does the User account and its access come into existence.

Today only half of that is true. The Resident flow already defers everything to acceptance and is complete on the backend, but the emailed link points at a URL that does not resolve, so nobody can finish it. The Staff flow is inverted: `InviteStaffUser` creates the User and writes the Account and Location role rows inside the invite transaction, generates a token, hashes it, and then discards it without sending anything. No acceptance step exists.

The main risk in M5 is the Staff rework. Moving role creation out of the invite path changes the post-conditions that `StaffManagementApiTest` currently asserts, and it removes invited people from the staff list until they accept. Treat M5 as a schema and authorization milestone first, then build the two acceptance pages.

## Current Starting Point

Already present:

- `user_invitations` table with ULID key, Account, Location, User, and Resident foreign keys, email, name snapshot, `token_hash`, `purpose`, `status`, `expires_at`, `accepted_at`, and `invited_by_user_id`.
- Partial unique index `user_invitations_pending_unique` on `(account_id, email, purpose) WHERE status = 'pending'`.
- `UserInvitationPurpose` (`staff`, `resident`) and `UserInvitationStatus` (`pending`, `accepted`, `expired`, `cancelled`) enums.
- Token generation as `Str::random(64)` stored only as `hash('sha256', $token)`.
- Configurable expiry per purpose in `config/wasiy.php`, defaulting to 14 days.
- Daily `invitations:expire-stale` command as an expiry backstop.
- Complete Resident claim backend: `GET /api/resident-invitations/{token}`, `POST /api/resident-invitations/{token}/claim`, `ClaimResidentInvitation` with `lockForUpdate`, and `ResidentInvitationNotification`.
- Staff invite endpoint `POST /api/accounts/{account}/staff/invitations`, gated by `manageStaff`, with `StoreStaffInvitationRequest` validating roles and requiring at least one grant.
- Activity logging for `StaffInvited`, `ResidentInvited`, and `ResidentClaimed`.

Still missing for M5:

- Somewhere on the invitation to hold the roles a Staff invitee should receive on acceptance.
- Staff invitation notification, acceptance endpoints, and acceptance action.
- Any frontend page for accepting either kind of invitation.
- A correct claim URL for Resident invitations.
- Authentication of the user as part of acceptance, so acceptance does not dead-end at a login form.
- Visibility of pending invitations in the staff list.
- Revocation and resend, which become load-bearing once a pending invitation carries an unclaimed grant.
- Handling for an invitee who already has a User account.

## Implementation Strategy

Build the smallest complete path first. Resident acceptance is one page away from working and establishes the pattern the Staff page reuses, so it goes first even though the Staff gap is more serious.

Recommended order:

1. Shared invitation token resolution service.
2. Resident acceptance frontend and claim URL fix, with sign-in on acceptance.
3. Staff invitation schema change and deferred granting.
4. Staff notification and acceptance API.
5. Staff acceptance frontend.
6. Pending invitation visibility, revocation, and resend.
7. Seed scenarios and final acceptance.

## Decisions to Confirm Before Slice 3

These change the shape of the code and are expensive to retrofit. Confirm them before the schema lands.

**Existing users do not create an account.** A Location Manager added to a second property, or a Resident portal user hired at the front desk, already has a password. Acceptance for them is a confirmation, not a signup. The acceptance page runs in two modes behind one URL, and the read endpoint reports which one applies.

**Authenticated acceptance is required for existing users.** If a User already exists for the invitation email, the accept call requires a session belonging to that email. An unauthenticated caller gets a response telling the SPA to send them to login and return to the token. A caller authenticated as a different email gets a conflict naming the invited address, so the page can offer to sign out.

**Dead locations are skipped, not fatal.** Role assignments sit on the invitation for up to 14 days and a Location can be soft-deleted in that window. Acceptance drops assignments whose Location no longer resolves and reports them, rather than failing the whole acceptance. Acceptance only fails when nothing grantable remains.

**Acceptance signs the user in.** Both flows authenticate the user inside the acceptance transaction and return the same payload shape as `/api/me`, so the SPA writes it straight into the session cache and lands them in the app. Without this, a user sets a password and is then asked to type it again.

**Resident existing-user merge stays out of scope.** `ClaimResidentInvitation` currently rejects an email belonging to another User with an explicit "not available yet" message. That stays. Solving identity merge for Residents is its own milestone; M5 only guarantees Staff handles the existing-user case, because for Staff it is routine rather than an edge case.

## Slice 1: Shared Invitation Token Resolution

Extract the token lookup that `ResidentInvitationController::validPendingInvitationForToken` performs today into a service both purposes use, so the 410 semantics and the expire-on-read behavior cannot drift apart.

- Add `App\Services\UserInvitationTokenResolver`.
- Method `resolve(string $token, UserInvitationPurpose $purpose, array $with = []): UserInvitation`.
- Look up by `hash('sha256', $token)` scoped to the purpose. Abort 410 when the row is missing or its status is not `Pending`.
- When `expires_at` is past, flip the row to `Expired` and abort 410, preserving current behavior.
- Rewrite `ResidentInvitationController` to call the resolver and delete its private method.

Scoping the lookup by purpose matters: it stops a Resident token from being presented to a Staff endpoint even though `token_hash` is globally unique.

### Slice 1 Tests

- A valid pending token resolves for its own purpose and 410s for the other purpose.
- An unknown token, an accepted token, and a cancelled token each 410.
- An expired token 410s and leaves the row marked `Expired`.
- Existing `ResidentInvitationClaimApiTest` continues to pass unchanged.

## Slice 2: Resident Acceptance Frontend

The backend is complete. This slice makes the emailed link land somewhere real and removes the trailing login step.

Backend:

- Point `WASIY_RESIDENT_INVITATION_CLAIM_URL` at the SPA origin, not `APP_URL`. The current default resolves to the API host at a path defined in neither `routes/web.php` nor the SPA route tree. Add it to `.env.example` with the SPA origin and document the production value.
- In `ClaimResidentInvitation`, authenticate the user after the invitation is marked accepted and regenerate the session.
- Return the same payload `MeController` produces so the SPA can seed its session cache.

Frontend:

- Add a public route `/invitations/resident/$token` outside `_authenticated`, alongside `/login` and `/no-access`.
- On load, call `GET /api/resident-invitations/{token}`. Render the Account name, the Resident name, and the expiry.
- Render a password and confirmation form using React Hook Form and Zod, matching the login page conventions and surfacing Laravel validation errors through `applyLaravelValidationErrors`.
- On success, write the returned session payload into the `['auth','session']` query cache with `applyAuthenticatedMe` and navigate to the portal.
- Handle 410 with a dedicated expired or already-claimed state offering a link to `/login`, not a generic error notification.
- Add Spanish and English strings for every state.

### Slice 2 Tests

- API: claiming authenticates the user and the response carries the session payload.
- API: claiming twice returns 410 on the second attempt.
- Web: the page renders Account and Resident names from the lookup response.
- Web: submitting a valid password navigates to the portal and populates the session cache.
- Web: a 410 lookup renders the expired state rather than the form.
- Web: server-side validation errors bind to the password field.

## Slice 3: Staff Invitation Schema and Deferred Granting

This is the breaking slice. Roles stop existing until acceptance.

Migration `add_role_assignments_to_user_invitations_table`:

- Add nullable `json` column `role_assignments`.
- Shape: `{"account_role": "account_admin"|null, "location_assignments": [{"location_id": "...", "role": "location_manager"}]}`.
- Cast it to `array` on `UserInvitation` and add an accessor returning a typed value object, so the acceptance action does not read raw array keys.
- Backfill is not required for Resident rows, which leave the column null.
- Existing pending Staff rows carry no payload and cannot be accepted. Mark them `Cancelled` in the migration and note that those people already hold their roles from the old behavior, so no access is lost.

`InviteStaffUser` changes:

- Stop creating the `User`. Leave `user_id` null on the invitation, matching the Resident flow.
- Stop writing `AccountUserRole` and stop calling `SyncStaffLocationAssignments`.
- Persist the validated roles into `role_assignments`.
- Keep the deactivated-user and already-staff rejections, both of which still apply at invite time.
- Keep the name snapshot behavior: prefer an existing User's real name over the submitted one.
- Send the new notification from Slice 4.

Consequences to handle in this slice:

- `StaffManagementApiTest` asserts roles exist immediately after invite. Those assertions move to the acceptance tests, and the invite tests assert instead that the payload is stored and that no role rows were written.
- `StaffInvitationResource` should expose status, expiry, and a role summary, and must continue to omit the token.
- `AccountStaffController::index` builds its list from role rows, so invitees vanish from it until Slice 6 adds pending rows back.

### Slice 3 Tests

- Inviting a new email creates no `User` row and no role rows.
- Inviting an existing user creates no role rows and snapshots that user's real name.
- The stored `role_assignments` payload round-trips the account role and every location assignment.
- The deactivated-user and already-staff rejections still fire.
- The pending-uniqueness index still blocks a second pending invitation for the same account, email, and purpose.

## Slice 4: Staff Notification and Acceptance API

Add `App\Notifications\StaffInvitationNotification`, queued, mirroring `ResidentInvitationNotification`, with a claim URL from a new `wasiy.invitations.staff_claim_url` config key.

Routes, both public and both outside the `auth:sanctum` group:

- `GET /api/staff-invitations/{token}`
- `POST /api/staff-invitations/{token}/accept`

The read endpoint returns the Account name, the inviter's name, the invited email, the expiry, a human-readable summary of the roles being granted, and a `requires_account_creation` boolean that is true when no `User` exists for the invitation email. The SPA branches on that flag. Do not return the role payload verbatim; return a summary safe to show an unauthenticated visitor.

`App\Actions\Staff\AcceptStaffInvitation` runs in one transaction:

1. Resolve and lock the invitation.
2. Abort 410 if the Account is trashed.
3. Resolve the User by the invitation email.
4. If none exists, require `first_name`, `last_name`, `password`, and `password_confirmation` under `Password::default()`, and create the User.
5. If one exists, require an authenticated session for that same user. Respond 401 when unauthenticated and 409 when authenticated as a different user, naming the invited email so the page can offer a sign-out.
6. Abort 403 if the resolved User is deactivated.
7. Re-validate every assignment. Drop assignments whose Location is missing, trashed, or outside the Account, and collect the dropped ones.
8. Abort 410 when nothing grantable remains after re-validation.
9. Apply the account role with `updateOrCreate` and the surviving location assignments through `SyncStaffLocationAssignments`.
10. Set `user_id`, `status = Accepted`, and `accepted_at`.
11. Log a `StaffInvitationAccepted` activity event including any skipped assignments.
12. Authenticate the user, regenerate the session, and return the `/api/me` payload.

Add `StaffInvitationAccepted` to `ActivityEventType`.

Rate limiting already covers these routes through the `api` group throttle added earlier.

### Slice 4 Tests

- Accepting as a new user creates the User, applies the account role and every location role, and marks the invitation accepted.
- The accepted user can immediately reach an endpoint their new role permits.
- Accepting an invitation for an existing email while unauthenticated returns 401 without mutating anything.
- Accepting while authenticated as a different user returns 409 and names the invited email.
- Accepting as the correct existing user applies the roles without touching their password.
- A soft-deleted Location in the payload is skipped, the remaining grants apply, and the skipped entry appears in the activity metadata.
- An invitation whose grants have all become invalid returns 410.
- A deactivated user cannot accept.
- Accepting twice returns 410 on the second attempt.
- Two concurrent accepts produce exactly one accepted invitation.

## Slice 5: Staff Acceptance Frontend

Reuse the Slice 2 pattern.

- Add a public route `/invitations/staff/$token`.
- Call the read endpoint and branch on `requires_account_creation`.
- Creation mode: first name, last name, password, and confirmation, with names prefilled from the invitation snapshot.
- Confirmation mode: show the Account and role summary with a single accept action. When the accept call returns 401, redirect to `/login` carrying a redirect back to the token URL, reusing `getSafeRedirectPath`. When it returns 409, show the invited email and offer to sign out and retry.
- On success, seed the session cache and route through `getDefaultAuthenticatedRoute`, so a new Account Admin lands on `/admin` and a Front Desk hire lands on `/front-desk`.
- Handle 410 with the same expired state as the Resident page. Extract the shared presentation from Slice 2 rather than duplicating it.
- Add Spanish and English strings.

### Slice 5 Tests

- Creation mode renders when `requires_account_creation` is true and confirmation mode when it is false.
- A successful acceptance seeds the session cache and routes by role.
- A 401 redirects to login preserving the token in the redirect param.
- A 409 renders the wrong-account state with a sign-out action.
- A 410 renders the expired state.

### Slices 1-5 Implementation Handoff

- Status: slices 1 through 5 are implemented and green. See the slice 6 handoff below for the current state.
- Changed areas: `app/Services/UserInvitationTokenResolver.php`, `app/Actions/Staff/InviteStaffUser.php`, `app/Actions/Staff/AcceptStaffInvitation.php`, `app/Notifications/StaffInvitationNotification.php`, `app/Http/Controllers/Api/StaffInvitationController.php`, `app/Http/Controllers/Api/ResidentInvitationController.php`, `app/Models/UserInvitation.php`, `app/Enums/ActivityEventType.php`, `database/migrations/2026_07_27_000001_add_role_assignments_to_user_invitations_table.php`, `config/wasiy.php`, `.env.example`, `routes/api.php`, and the `apps/web/src/features/invitations/` module with public routes under `apps/web/src/routes/invitations/`.
- Verification: 184 API tests and 37 web tests pass; Pint, ESLint, `tsc -b`, and `vite build` are clean. The build still reports the pre-existing large chunk warning.
- Decisions: the staff invite response dropped its `data.staff` key, because no User exists at invite time. Role-to-label mapping moved into `getRoleLabelKey` in `features/auth/access.ts` rather than being duplicated in the new page. Acceptance signs the user in and returns the `/api/me` payload under a `session` key, which is null when the request is not stateful so the SPA falls back to `/login`.
- Follow-up: slice 6 is the next unit of work. Note that pending invitations are currently invisible to admins, which matters more now that a pending invitation carries an unclaimed grant.

## Slice 6: Pending Visibility, Revocation, and Resend

Once a pending invitation carries an unclaimed grant, an unopened inbox holds live access. Admins need to see and withdraw it.

- Extend `GET /api/accounts/{account}/staff` to include pending Staff invitations as entries distinguishable from real staff, carrying invitation id, email, name snapshot, role summary, expiry, and inviter. Keep pagination coherent; the simplest correct approach is a separate `pending_invitations` key rather than unioning two different shapes into one paginated list.
- `DELETE /api/accounts/{account}/staff/invitations/{invitation}` sets `status = Cancelled`, gated by `manageStaff`, scoped so an invitation from another Account 404s. This is the first code to ever write the `Cancelled` status.
- `POST /api/accounts/{account}/staff/invitations/{invitation}/resend` issues a new token, extends the expiry, and re-sends the notification. Necessary because the plaintext token is unrecoverable and the pending-unique index blocks simply inviting again.
- Log `StaffInvitationCancelled` and `StaffInvitationResent`.
- Apply the same cancel and resend endpoints to Resident invitations, which have the identical unrecoverable-token problem.

Note that the SPA has no staff management page yet; `/admin/staff` is a nav entry pointing at a route that does not exist. This slice is API-only, and the admin UI for it belongs to whichever milestone builds that page.

### Slice 6 Tests

- The staff list reports pending invitations separately from active staff.
- Cancelling sets `Cancelled` and the token then 410s at the acceptance endpoint.
- Cancelling an invitation belonging to another Account returns 404.
- Resending invalidates the previous token and the new token accepts successfully.
- A non-admin cannot cancel or resend.

### Slice 6 Implementation Handoff

- Status: implemented and green. Only slice 7 remains.
- Changed areas: `app/Actions/Invitations/CancelUserInvitation.php`, `app/Actions/Invitations/ResendUserInvitation.php`, `app/Http/Controllers/Api/StaffInvitationController.php`, `app/Http/Controllers/Api/ResidentInvitationController.php`, `app/Http/Controllers/Api/AccountStaffController.php`, `app/Services/AccessAuthorizationService.php`, `app/Actions/Residents/InviteResidentUser.php`, `app/Enums/ActivityEventType.php`, and `routes/api.php`.
- Verification: 192 API tests pass; Pint clean. Web is untouched this slice.
- Decisions: pending invitations ride along on the staff list under a `pending_invitations` key added with `->additional()`, returned whole and unfiltered because they are a small bounded set rendered as their own section rather than part of the paginated table. Cancel and resend are shared across both purposes by two actions that switch on `purpose` for the event type and notification. `manageableInvitationLocationForResident` moved from a private method on `InviteResidentUser` into `AccessAuthorizationService` so cancel and resend authorize exactly like issuing does. Non-pending invitations return 422 rather than 404, since the caller is allowed to see the record.
- Follow-up: slice 7 (seed scenarios, the `UserInvitationFactory` bcrypt fix, and a token-returning factory helper). Separately, the admin UI for pending invitations belongs to whichever milestone builds `/admin/staff`, which still does not exist.

## Slice 7: Seed Scenarios and Final Acceptance

- Extend the seeder with a pending Staff invitation, a pending Resident invitation, an expired invitation, and an accepted invitation, so every state is reachable in local browsing.
- Fix `UserInvitationFactory`, which generates `token_hash` with `Hash::make` while all production code uses `hash('sha256', ...)`. Factory-built invitations can never be found by token lookup, which will silently break the first test that tries.
- Add a factory helper returning both the plaintext token and the persisted row, so acceptance tests can drive the real endpoints.
- Verify with the full API suite, Pint, and the web test, lint, and build commands.

### Slice 7 Tests

- Seeded invitations cover pending, accepted, expired, and cancelled for both purposes.
- The factory helper produces a token that resolves through `UserInvitationTokenResolver`.

### Slice 7 Implementation Handoff

- Status: implemented and green. M5 is complete.
- Changed areas: `database/factories/UserInvitationFactory.php`, `database/seeders/DatabaseSeeder.php`, and `tests/Feature/DatabaseSeederTest.php`.
- Verification: 194 API tests and 37 web tests pass; `pint --test`, ESLint, `tsc -b`, and `vite build` are clean. `migrate:fresh --seed` produces all five invitation states.
- Decisions: the factory now hashes with `hash('sha256', ...)` to match production, and exposes `createWithToken()` returning the row plus plaintext token, alongside `forToken()`, `resident()`, `expired()`, `accepted()`, and `cancelled()` states. Seeded Staff tokens are fixed strings (`staff-demo-invitation-token` and friends) so the acceptance pages can be opened by hand while browsing locally.
- Follow-up: the admin UI for pending invitations still has no home, because `/admin/staff` does not exist as a route. That belongs to whichever milestone builds the staff management page.

## Suggested Pull Request Breakdown

1. Shared token resolver and Resident controller refactor.
2. Resident claim URL fix, sign-in on claim, and the Resident acceptance page.
3. `role_assignments` migration and deferred Staff granting, with reworked staff tests.
4. Staff notification, read and accept endpoints, and the acceptance action.
5. Staff acceptance page and shared invitation-page presentation.
6. Pending visibility, cancel, and resend for both purposes.
7. Seeders, factory fix, and final acceptance pass.

## Definition of Done

M5 is done when the product can correctly answer these questions:

- Does every invited person receive an email containing a link that resolves to a working page?
- Is it true that no User row and no role row exists for an invited person until they accept?
- Does an invitee who already has an account confirm and join instead of being asked to sign up again?
- Is an invitation addressed to someone else refused when a different user is signed in?
- What happens to a pending invitation when its Location is deleted before acceptance, and is the skip recorded?
- Can an Account Admin see, cancel, and resend pending invitations for their Account?
- Does accepting an invitation sign the user in and land them on the surface their new role grants?
- Is every acceptance, cancellation, and resend captured in the Activity Log?
- Does a token work exactly once, for exactly one purpose, and stop working at expiry?
