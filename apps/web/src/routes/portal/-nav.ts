import { Bell, Calendar, Garage, Home, User } from '@solar-icons/react'
import type { LayoutNavLeaf } from '../../components/layout/shared/types'

export const portalNavItems: LayoutNavLeaf[] = [
  { icon: Home, labelKey: 'nav.home', to: '/portal' },
  { icon: Calendar, labelKey: 'nav.reservations', to: '/portal/reservations' },
  { icon: User, labelKey: 'nav.visitors', to: '/portal/visitors' },
  { icon: Garage, labelKey: 'nav.vehicles', to: '/portal/vehicles' },
  { icon: Bell, labelKey: 'nav.announcements', to: '/portal/announcements' },
]
