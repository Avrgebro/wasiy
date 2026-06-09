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
  role: LocationRole
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
  roles: {
    account: AccountRoleAssignment[]
    location: LocationRoleAssignment[]
  }
  assigned_locations: LocationSummary[]
  resident_memberships: unknown[]
}

export type LoginCredentials = {
  email: string
  password: string
}
