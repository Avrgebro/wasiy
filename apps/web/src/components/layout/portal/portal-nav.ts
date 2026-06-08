import { Bell, CalendarDays, Car, Home, UserRound } from 'lucide-react'
import type { LayoutNavItem } from '../shared/types'

export const portalNavItems: LayoutNavItem[] = [
  { icon: Home, labelKey: 'nav.home', to: '/portal' },
  { icon: CalendarDays, labelKey: 'nav.reservations', to: '/portal/reservations' },
  { icon: UserRound, labelKey: 'nav.visitors', to: '/portal/visitors' },
  { icon: Car, labelKey: 'nav.vehicles', to: '/portal/vehicles' },
  { icon: Bell, labelKey: 'nav.announcements', to: '/portal/announcements' },
]

