import type { ComponentType } from 'react'
import type { DynamicIconProps } from '@solar-icons/react/lib/dynamic-icon'
import type { FileRouteTypes } from '@surface/routeTree'

/** Nav icons come from `@solar-icons/react/dynamic` so the active state can switch weight. */
export type LayoutIcon = ComponentType<DynamicIconProps>
export type LayoutIconWeight = NonNullable<DynamicIconProps['weight']>

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
  iconWeight?: LayoutIconWeight
  labelKey: string
  to: LayoutNavTarget
}

export type LayoutNavCollapsible = {
  type: 'collapsible'
  children: LayoutNavLeaf[]
  defaultOpen?: boolean
  icon: LayoutIcon
  iconWeight?: LayoutIconWeight
  labelKey: string
}

export type LayoutNavItem = LayoutNavLeaf | LayoutNavCollapsible

export type LayoutNavGroup = {
  type: 'group'
  items: LayoutNavItem[]
  titleKey: string
}

export type LayoutNavEntry = LayoutNavItem | LayoutNavGroup
