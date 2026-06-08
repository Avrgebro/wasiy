import { CalendarDays, DoorOpen, Search, UserRoundCheck } from 'lucide-react'
import type { LayoutNavItem } from '../shared/types'

export const frontDeskNavItems: LayoutNavItem[] = [
  { icon: UserRoundCheck, labelKey: 'nav.checkIn', to: '/front-desk' },
  { icon: DoorOpen, labelKey: 'nav.todaysVisitors', to: '/front-desk/visitors' },
  { icon: Search, labelKey: 'nav.unitLookup', to: '/front-desk/units' },
  { icon: CalendarDays, labelKey: 'nav.reservations', to: '/front-desk/reservations' },
]

