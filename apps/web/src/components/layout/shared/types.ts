import type { ComponentType } from 'react'
import type { IconProps } from '@solar-icons/react'
import type { FileRouteTypes } from '../../../routeTree.gen'

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
  icon: LayoutIcon
  labelKey: string
  to: LayoutNavTarget
}

export type LayoutNavCollapsible = {
  type: 'collapsible'
  children: LayoutNavLeaf[]
  defaultOpen?: boolean
  icon: LayoutIcon
  labelKey: string
}

export type LayoutNavItem = LayoutNavLeaf | LayoutNavCollapsible

export type LayoutNavGroup = {
  type: 'group'
  items: LayoutNavItem[]
  titleKey: string
}

export type LayoutNavEntry = LayoutNavItem | LayoutNavGroup
