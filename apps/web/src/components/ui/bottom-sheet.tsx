import { Drawer, Text } from '@mantine/core'
import type { ReactNode } from 'react'

/**
 * The phone-side counterpart of AppDrawer: a sheet rising from the bottom
 * with rounded top corners, sized to its content. Used by the portal for the
 * unit switcher and detail views.
 */
export function BottomSheet({
  children,
  description,
  onClose,
  opened,
  title,
}: {
  children: ReactNode
  description?: string
  onClose: () => void
  opened: boolean
  title: ReactNode
}) {
  return (
    <Drawer
      opened={opened}
      padding={0}
      position="bottom"
      size="auto"
      styles={{
        content: { borderTopLeftRadius: 'var(--radius-surface)', borderTopRightRadius: 'var(--radius-surface)', maxHeight: '85dvh' },
        header: { padding: '1rem 1.5rem 0.75rem' },
        body: { padding: '0 1.5rem 1.5rem' },
      }}
      title={
        <div>
          <Text fw={700} size="lg">
            {title}
          </Text>
          {description ? (
            <Text c="dimmed" size="xs">
              {description}
            </Text>
          ) : null}
        </div>
      }
      onClose={onClose}
    >
      {children}
    </Drawer>
  )
}
