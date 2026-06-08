import {
  Building2,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  LayoutDashboard,
  Megaphone,
  UsersRound,
} from 'lucide-react'
import type { LayoutNavItem } from '../shared/types'

export const adminNavItems: LayoutNavItem[] = [
  { icon: LayoutDashboard, labelKey: 'nav.dashboard', to: '/admin' },
  { icon: Building2, labelKey: 'nav.units', to: '/admin/units' },
  { icon: UsersRound, labelKey: 'nav.residents', to: '/admin/residents' },
  { icon: DoorOpen, labelKey: 'nav.visitors', to: '/admin/visitors' },
  { icon: CalendarDays, labelKey: 'nav.reservations', to: '/admin/reservations' },
  { icon: Megaphone, labelKey: 'nav.announcements', to: '/admin/announcements' },
  { icon: ClipboardList, labelKey: 'nav.activity', to: '/admin/activity' },
]

