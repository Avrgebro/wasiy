import type {
  LayoutNavCollapsible,
  LayoutNavEntry,
  LayoutNavGroup,
  LayoutNavItem,
  LayoutNavLeaf,
} from '../../components/layout/shared/types'
import type { MeResponse } from '../auth/types'

/**
 * Navigation is declared once as a spec tree; each entry decides for itself who
 * may see it. Filtering happens at render, so adding a role means adding a
 * predicate rather than another hand-maintained copy of the whole menu.
 */
type NavPredicate = (me: MeResponse) => boolean

export type NavLeafSpec = LayoutNavLeaf & { visibleTo?: NavPredicate }

export type NavCollapsibleSpec = Omit<LayoutNavCollapsible, 'children'> & {
  children: NavLeafSpec[]
  visibleTo?: NavPredicate
}

type NavItemSpec = NavLeafSpec | NavCollapsibleSpec

export type NavGroupSpec = Omit<LayoutNavGroup, 'items'> & {
  items: NavItemSpec[]
  visibleTo?: NavPredicate
}

export type NavEntrySpec = NavItemSpec | NavGroupSpec

function isVisible(spec: { visibleTo?: NavPredicate }, me: MeResponse) {
  return spec.visibleTo?.(me) ?? true
}

function isCollapsible(item: NavItemSpec): item is NavCollapsibleSpec {
  return item.type === 'collapsible'
}

function isGroup(entry: NavEntrySpec): entry is NavGroupSpec {
  return entry.type === 'group'
}

function filterNavigationItems(
  items: NavItemSpec[],
  me: MeResponse,
): LayoutNavItem[] {
  return items.flatMap((item): LayoutNavItem[] => {
    if (!isVisible(item, me)) {
      return []
    }

    if (!isCollapsible(item)) {
      return [item]
    }

    const children = item.children.filter((child) => isVisible(child, me))

    // A collapsible that expands to nothing is noise.
    return children.length > 0 ? [{ ...item, children }] : []
  })
}

export function filterNavigationEntries(
  entries: NavEntrySpec[],
  me: MeResponse,
): LayoutNavEntry[] {
  return entries.flatMap((entry): LayoutNavEntry[] => {
    if (!isVisible(entry, me)) {
      return []
    }

    if (!isGroup(entry)) {
      return filterNavigationItems([entry], me)
    }

    const items = filterNavigationItems(entry.items, me)

    // An empty section renders nothing rather than an orphan heading.
    return items.length > 0 ? [{ ...entry, items }] : []
  })
}

