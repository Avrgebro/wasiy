import { Drawer, Group, ScrollArea, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'

/** One width for every sheet; below the laptop breakpoint it takes the screen. */
const DRAWER_WIDTH = 620
const LAPTOP_UP = '(min-width: 64rem)'

/**
 * The sheet owns its inset: Mantine's padding is zeroed and header, body and
 * footer each apply this, so the body's scroll area can reach the sheet's
 * edge and the scrollbar sits there, well clear of the inputs.
 */
const INSET = '1.5rem'

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
      padding={0}
      size={laptopUp ? DRAWER_WIDTH : '100%'}
      styles={{
        content: { display: 'flex', flexDirection: 'column', maxWidth: '100vw' },
        header: {
          borderBottom: '1px solid var(--mantine-color-default-border)',
          marginBottom: 'var(--mantine-spacing-md)',
          padding: `var(--mantine-spacing-md) ${INSET}`,
        },
        body: { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, padding: 0 },
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
 * The scrollable middle of the sheet. It spans the sheet edge to edge; the
 * scrollbar gets a reserved 0.5rem lane at that edge (offsetScrollbars) and
 * the content carries the inset, minus the lane on the right so inputs end
 * at the same distance from both edges. The inset also gives Mantine's focus
 * ring room to paint inside the clip boundary.
 */
export function AppDrawerBody({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="min-h-0 flex-1" offsetScrollbars="y" scrollbarSize="0.5rem" type="auto">
      {/* Tailwind needs literal classes: 1.5rem is INSET, 0.5rem the scrollbar lane. */}
      <div className="grid content-start gap-4 pt-1 pb-5 pl-[1.5rem] pr-[calc(1.5rem-0.5rem)]">{children}</div>
    </ScrollArea>
  )
}

export function AppDrawerFooter({ children }: { children: ReactNode }) {
  return (
    <Group
      justify="flex-end"
      className="border-0 border-t border-solid border-[var(--mantine-color-default-border)] px-[1.5rem] py-4"
    >
      {children}
    </Group>
  )
}
