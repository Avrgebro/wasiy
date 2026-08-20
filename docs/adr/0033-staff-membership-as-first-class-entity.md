# Staff Membership as First-Class Entity

Wasiy will model account staff as a first-class `StaffMembership` record (`staff_memberships`: one row per Account and User) instead of deriving staff-ness from the union of role tables. The membership owns the relationship itself, the optional account-level role, and per-account deactivation; location roles hang off the membership in `staff_location_roles` with composite foreign keys that guarantee a membership's location roles always belong to the same Account. The former `account_user_roles` and `location_user_roles` tables are dropped: `account_user_roles` was already unique per (Account, User), so the account role collapses into a nullable `account_role` column on the membership.

Deriving "is this person staff of this Account" from role rows made zero-role staff impossible — removing someone's last role silently removed them from the staff list and broke the access-update endpoint — and it left per-account deactivation with no home, forcing `users.deactivated_at` (a global login ban) to stand in for "suspended from this Account's team". A stored membership makes offboarding an explicit, reversible state with history instead of an absence of rows.

## Decisions

- `staff_memberships` is the source of truth for the staff list. Members with no roles remain listed ("Sin asignaciones") instead of vanishing.
- The account role lives on the membership as a single nullable column. An Account grants at most one account-level role per User.
- Account role and location roles remain mutually exclusive (an Account Admin already reaches every Location). This is a cross-table rule the database cannot express, so it stays application-enforced in the staff request validation and actions — the documented limit of relational enforcement in this design.
- `staff_location_roles` references the membership and the Location through composite foreign keys sharing `account_id`, so cross-account role rows are impossible by construction, and deleting a membership cascades its roles.
- Per-account suspension is `staff_memberships.deactivated_at`: the member stays listed (dimmed) with history intact, but a deactivated membership grants no access in that Account — authorization, accessible accounts/locations, and context selection all require an active membership.
- `users.deactivated_at` is demoted to a platform-level ban (login block), set only by platform tooling, never by Account Admins. This refines ADR 0032, whose reasoning still stands at the platform level.
- No data migration: demo data is reseeded; the seeders create memberships directly.

## Consequences

Every previously unreachable state becomes real and testable: role-less staff, per-account deactivation and reactivation, and a status filter on the staff list. Future per-account staff attributes (joined date, invited-by, notes) have an obvious home. The cost is a wide one-time rewrite of `AccessAuthorizationService`, `/api/me` assembly, the staff actions, seeders, and the feature tests that seeded role rows directly — accepted now, while the product is pre-production, because every later milestone builds on whichever model exists.
