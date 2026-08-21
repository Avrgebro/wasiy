import type { LayoutNavEntry, LayoutNavItem, LayoutNavLeaf } from './types'

export function isActivePath(pathname: string, item: LayoutNavLeaf) {
  const { activeMatch = 'exact', to } = item

  if (to === '/') {
    return pathname === '/'
  }

  if (activeMatch === 'prefix') {
    return pathname === to || pathname.startsWith(`${to}/`)
  }

  return pathname === to
}

function findInItems(items: LayoutNavItem[], pathname: string) {
  for (const item of items) {
    if (item.type === 'collapsible') {
      const child = item.children.find((candidate) =>
        isActivePath(pathname, candidate),
      )

      if (child) return child
    } else if (isActivePath(pathname, item)) {
      return item
    }
  }

  return undefined
}

export function findActiveNavItem(
  navItems: LayoutNavEntry[],
  pathname: string,
) {
  for (const entry of navItems) {
    const active =
      entry.type === 'group'
        ? findInItems(entry.items, pathname)
        : findInItems([entry], pathname)

    if (active) return active
  }

  return undefined
}
