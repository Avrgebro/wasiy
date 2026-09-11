import { Drawer, Group, MantineThemeProvider, MultiSelect, ScrollArea, Select, TagsInput, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'

/** Default form width; below the laptop breakpoint it takes the screen. */
const DRAWER_WIDTH = 620
const LAPTOP_UP = '(min-width: 64rem)'

/**
 * Combobox dropdowns inside a sheet render in place, not in the body-level
 * portal. Chrome on touch (device mode and Android) repaints the fixed sheet
 * from a stale frame when a dropdown layer appears outside its stacking
 * context, which reads as the drawer closing and reopening; Safari and
 * pointer Chrome never did. Verified 2026-09-11 by bisection: transitions,
 * compositor hints, the shared portal node and the topbar blur were all
 * ruled out, `withinPortal: false` alone fixes it. Scoped here so table
 * filters and the rest keep the portal and its clipping-free dropdowns.
 */
const IN_PLACE_DROPDOWNS = {
  components: {
    Select: Select.extend({ defaultProps: { comboboxProps: { withinPortal: false } } }),
    MultiSelect: MultiSelect.extend({ defaultProps: { comboboxProps: { withinPortal: false } } }),
    TagsInput: TagsInput.extend({ defaultProps: { comboboxProps: { withinPortal: false } } }),
  },
}

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
 * pinned to the bottom. Forms use the default width for two columns;
 * compact panels such as filters can override it.
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
  width = DRAWER_WIDTH,
  title,
}: {
  children: ReactNode
  onClose: () => void
  opened: boolean
  subtitle?: string
  /** Desktop width; forms default to 620px. */
  width?: number
  title: ReactNode
}) {
  const laptopUp = useMediaQuery(LAPTOP_UP, true, { getInitialValueInEffect: false })

  return (
    <Drawer
      opened={opened}
      position="right"
      padding={0}
      size={laptopUp ? width : '100%'}
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
      <MantineThemeProvider inherit theme={IN_PLACE_DROPDOWNS}>
        {children}
      </MantineThemeProvider>
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
