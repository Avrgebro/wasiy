import type { ComponentType } from 'react'
import type { IconProps } from '@solar-icons/react'

export type LayoutIcon = ComponentType<IconProps>

export type LayoutNavLeaf = {
  activeMatch?: 'exact' | 'prefix'
  type?: 'item'
  icon: LayoutIcon
  labelKey: string
  to: string
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
