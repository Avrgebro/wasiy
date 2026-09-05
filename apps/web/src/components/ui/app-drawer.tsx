import { Drawer, Group, ScrollArea, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'

/** One width for every sheet; below the laptop breakpoint it takes the screen. */
const DRAWER_WIDTH = 620
const LAPTOP_UP = '(min-width: 64rem)'

/**
 * The app's standard right-side sheet: 620px on laptops and up, the full
 * viewport on tablets and phones, a header with optional subtitle, and a
 * column layout where AppDrawerBody scrolls and AppDrawerFooter stays
 * pinned to the bottom. Every drawer shares the width on purpose: forms
 * were designed for two columns at this size and a narrower sheet made
 * them wrap.
 *
 * Compose the pieces inside your own <form> when the footer submits:
 *
 *   <AppDrawer opened onClose title subtitle>
 *     <form className="flex min-h-0 flex-1 flex-col">
 *       <AppDrawerBody>…fields…</AppDrawerBody>
 *       <AppDrawerFooter>…actions…</AppDrawerFooter>
 *     </form>
 *   </AppDrawer>
 */
export function AppDrawer({
  children,
  onClose,
  opened,
  subtitle,
  title,
}: {
  children: ReactNode
  onClose: () => void
  opened: boolean
  subtitle?: string
  title: ReactNode
}) {
  const laptopUp = useMediaQuery(LAPTOP_UP, true, { getInitialValueInEffect: false })

  return (
    <Drawer
      opened={opened}
      position="right"
      size={laptopUp ? DRAWER_WIDTH : '100%'}
      styles={{
        content: { display: 'flex', flexDirection: 'column', maxWidth: '100vw' },
        header: {
          borderBottom: '1px solid var(--mantine-color-default-border)',
          marginBottom: 'var(--mantine-spacing-md)',
        },
        body: { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, paddingBottom: 0 },
      }}
      title={
        subtitle ? (
          <div>
            <Text fw={700} size="lg">
              {title}
            </Text>
            <Text c="dimmed" size="xs">
              {subtitle}
            </Text>
          </div>
        ) : (
          <Text fw={700} size="lg">
            {title}
          </Text>
        )
      }
      onClose={onClose}
    >
      {children}
    </Drawer>
  )
}

/**
 * The scrollable middle of the sheet. Two rendering traps live here:
 * scrolling clips horizontally too, which would shear Mantine's focus ring
 * off the inputs' edges — the negative-margin/padding pair gives the ring
 * room to paint inside the clip boundary; and an overlay scrollbar would
 * paint on top of the inputs — offsetScrollbars reserves a real gutter for
 * it instead.
 */
export function AppDrawerBody({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="-mx-1 -mt-1 min-h-0 flex-1" offsetScrollbars type="auto">
      <div className="grid content-start gap-5 px-1 pb-5 pt-1">{children}</div>
    </ScrollArea>
  )
}

export function AppDrawerFooter({ children }: { children: ReactNode }) {
  return (
    <Group
      justify="flex-end"
      className="border-0 border-t border-solid border-[var(--mantine-color-default-border)] py-4"
    >
      {children}
    </Group>
  )
}
