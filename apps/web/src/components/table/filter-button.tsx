import { Badge, Button, Popover, Stack } from '@mantine/core'
import { Filter } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

/**
 * Toolbar entry point for a table's configured filters: a button with an
 * active-count badge opening a popover card. The page supplies its own
 * filter inputs as children; changes apply immediately — there is no
 * staged "apply" step.
 */
export function FilterButton({
  activeCount,
  children,
}: {
  activeCount: number
  children: ReactNode
}) {
  const { t } = useTranslation('common')

  return (
    <Popover position="bottom-start" shadow="md" width={280}>
      <Popover.Target>
        <Button
          leftSection={<Filter size={16} />}
          rightSection={
            activeCount > 0 ? (
              <Badge circle size="sm" variant="filled">
                {activeCount}
              </Badge>
            ) : null
          }
          variant="default"
        >
          {t('table.filters')}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">{children}</Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
