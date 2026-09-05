import type { ComponentType } from 'react'
import type { IconProps, IconWeight } from '@solar-icons/react'
import type { FileRouteTypes } from '@surface/routeTree'

export type LayoutIcon = ComponentType<IconProps>

/**
 * Only paths the router actually serves. Typing this against the generated
 * route tree turns a nav entry pointing at a nonexistent page into a compile
 * error instead of a runtime not-found.
 */
export type LayoutNavTarget = FileRouteTypes['to']

export type LayoutNavLeaf = {
  activeMatch?: 'exact' | 'prefix'
  type?: 'item'
  /** Optional live counter rendered after the label (e.g. pending reservations). */
  badge?: ComponentType
  icon: LayoutIcon
  /** Solar weight; the sidebar defaults to Linear. */
  iconWeight?: IconWeight
  labelKey: string
  to: LayoutNavTarget
}

export type LayoutNavCollapsible = {
  type: 'collapsible'
  children: LayoutNavLeaf[]
  defaultOpen?: boolean
  icon: LayoutIcon
  iconWeight?: IconWeight
  labelKey: string
}

export type LayoutNavItem = LayoutNavLeaf | LayoutNavCollapsible

export type LayoutNavGroup = {
  type: 'group'
  items: LayoutNavItem[]
  titleKey: string
}

export type LayoutNavEntry = LayoutNavItem | LayoutNavGroup
