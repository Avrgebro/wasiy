export type AccountRole = 'account_admin'

export type LocationRole = 'location_manager' | 'front_desk'

/**
 * What the current user may do in a Location. Computed by the API from the
 * role matrix (ADR 0036) and delivered per location; the SPA never derives
 * permissions from roles itself.
 */
export type Capability =
  | 'registry.view'
  | 'registry.manage'
  | 'reception.manage'
  | 'reservations.view'
  | 'reservations.create'
  | 'reservations.decide'
  | 'finances.manage'
  | 'announcements.manage'
  | 'location.settings'
  | 'account.manage'
  | 'subscription.manage'

export type AuthUser = {
  id: string
  first_name: string
  last_name: string
  name: string
  email: string
}

export type SubscriptionStatus = 'trialing' | 'active' | 'expired'

/**
 * The Account's standing with its plan, computed by the API (ADR 0039).
 * days_left and is_lapsed come from the server so every client agrees on
 * the countdown and the lock; the SPA never compares dates itself.
 */
export type SubscriptionSummary = {
  status: SubscriptionStatus
  plan: { code: string; name: string }
  unit_price_minor: number
  billable_units: number
  currency: string
  trial_ends_at: string
  access_until: string
  days_left: number
  is_lapsed: boolean
  contact_email: string
}

export type AccountSummary = {
  id: string
  name: string
  slug: string
  timezone: string
  locations_count: number
  /** Null for accounts created by hand; those are never gated. */
  subscription: SubscriptionSummary | null
  /** What the user holds in this account, for "Cuentas y accesos". */
  access: AccountAccess
}

export type AccountAccess = {
  account_role: AccountRole | null
  locations: Array<{ location_id: string; location_name: string; role: LocationRole }>
}

export type LocationSummary = {
  id: string
  account_id: string
  name: string
  slug: string
  timezone: string
  /** ISO 3166-1 alpha-2; dialing rules for phones. */
  country: string
  address: string | null
  roles: Array<AccountRole | LocationRole>
  capabilities: Capability[]
  access_source: 'account_role' | 'location_role' | 'both'
}

export type AccountRoleAssignment = {
  account_id: string
  role: AccountRole
}

export type LocationRoleAssignment = {
  account_id: string
  location_id: string
  role: LocationRole
}

export type ResidentMembership = {
  resident_id: string
  unit_membership_id: string
  account_id: string
  location_id: string
  unit_id: string
  unit_label: string
  country: string
  is_primary_contact: boolean
}

export type MeResponse = {
  user: AuthUser
  accounts: AccountSummary[]
  active_account: AccountSummary | null
  active_location: LocationSummary | null
  roles: {
    account: AccountRoleAssignment[]
    location: LocationRoleAssignment[]
  }
  accessible_locations: LocationSummary[]
  resident_memberships: ResidentMembership[]
}

export type LoginCredentials = {
  email: string
  password: string
  remember: boolean
}

// The three expected auth states, modeled as data so the session query only
// rejects on genuinely exceptional failures (network, 5xx). 'anonymous' maps
// from /api/me 401, 'deactivated' from the EnsureUserIsActive 403.
export type Session =
  | { status: 'authenticated'; me: MeResponse }
  | { status: 'anonymous' }
  | { status: 'deactivated' }
