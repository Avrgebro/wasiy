import type { ComboboxProps } from '@mantine/core'

/** Escape the panel's scroll clipping without adding options to its layout.
 * Mantine's default popover z-index is above drawers; allow placement to
 * change as the keyboard changes the available viewport.
 */
export const FILTER_COMBOBOX_PROPS = {
  withinPortal: true,
  floatingStrategy: 'fixed',
  preventPositionChangeWhenVisible: false,
} satisfies ComboboxProps
