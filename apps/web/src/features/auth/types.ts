export type AccountRole = 'account_admin'

export type LocationRole = 'location_manager' | 'front_desk'

export type AuthUser = {
  id: string
  first_name: string
  last_name: string
  name: string
  email: string
}

export type AccountSummary = {
  id: string
  name: string
  slug: string
  timezone: string
}

export type LocationSummary = {
  id: string
  account_id: string
  name: string
  slug: string
  timezone: string
  roles: Array<AccountRole | LocationRole>
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
  resident_memberships: unknown[]
}

export type LoginCredentials = {
  email: string
  password: string
}

// The three expected auth states, modeled as data so the session query only
// rejects on genuinely exceptional failures (network, 5xx). 'anonymous' maps
// from /api/me 401, 'deactivated' from the EnsureUserIsActive 403.
export type Session =
  | { status: 'authenticated'; me: MeResponse }
  | { status: 'anonymous' }
  | { status: 'deactivated' }
