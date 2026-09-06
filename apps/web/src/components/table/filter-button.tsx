import { Badge, Button, Group, Stack } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { FilterIcon } from '@solar-icons/react/linear'
import { useTranslation } from 'react-i18next'
import { useState, type ReactNode } from 'react'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../ui/app-drawer'
import { BottomSheet } from '../ui/bottom-sheet'

/** Filters apply immediately inside a desktop drawer or a mobile/tablet sheet. */
export function FilterButton({
  activeCount,
  children,
  onClearAll,
}: {
  activeCount: number
  children: ReactNode
  onClearAll: () => void
}) {
  const { t } = useTranslation('common')
  const [opened, setOpened] = useState(false)
  const desktop = useMediaQuery('(min-width: 64rem)', true, { getInitialValueInEffect: false })
  const close = () => setOpened(false)
  const actions = (
    <Group justify="space-between" w="100%">
      <Button disabled={activeCount === 0} style={{ flexShrink: 0 }} variant="default" onClick={onClearAll}>
        {t('table.clearFilters')}
      </Button>
      <Button style={{ flexShrink: 0 }} onClick={close}>{t('table.filtersDone')}</Button>
    </Group>
  )
  // Focus the panel instead of a searchable input when opening on touch devices.
  const fields = <Stack data-autofocus tabIndex={-1} gap="sm">{children}</Stack>

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-expanded={opened}
        leftSection={<FilterIcon size={16} />}
        rightSection={activeCount > 0 ? <Badge circle size="sm" variant="filled">{activeCount}</Badge> : null}
        variant="default"
        onClick={() => setOpened(true)}
      >
        {t('table.filters')}
      </Button>
      {desktop ? (
        <AppDrawer opened={opened} onClose={close} title={t('table.filters')} width={400}>
          <AppDrawerBody>{fields}</AppDrawerBody>
          <AppDrawerFooter>{actions}</AppDrawerFooter>
        </AppDrawer>
      ) : (
        <BottomSheet keyboardAware opened={opened} onClose={close} title={t('table.filters')} footer={actions} footerDivider>
          {fields}
        </BottomSheet>
      )}
    </>
  )
}
