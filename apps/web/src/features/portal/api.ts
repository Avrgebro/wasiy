import { apiRequest } from '../../app/api-client'
import type { ResidentMembership } from '../auth/types'

export type PortalResident = {
  id: string
  account_id: string
  user_id: string
  first_name: string
  last_name: string
  name: string
  phone: string | null
  email: string | null
  status: 'active' | 'inactive'
  memberships: ResidentMembership[]
}

type PortalResidentResponse = {
  data: PortalResident
}

export async function updatePortalResidentPhone(phone: string | null) {
  const response = await apiRequest<PortalResidentResponse>(
    '/api/portal/resident/phone',
    {
      data: { phone },
      method: 'PATCH',
    },
  )

  return response.data
}
