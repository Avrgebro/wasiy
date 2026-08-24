import { Button, Text } from '@mantine/core'
import { Buildings2 } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'

/**
 * Two flavors: filtered searches get "no results" with a way back to the
 * full list, a genuinely empty account gets the onboarding call to action.
 */
export function LocationEmptyState({
  filtered,
  onClearFilters,
  onCreate,
}: {
  filtered: boolean
  onClearFilters: () => void
  onCreate: () => void
}) {
  const { t } = useTranslation('common')

  return (
    <div className="grid min-h-72 place-items-center rounded-lg border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-6 text-center sm:p-10">
      <div className="flex flex-col items-center gap-2">
        <Buildings2 className="text-[var(--mantine-color-dimmed)]" size={28} />
        <Text fw={700}>
          {filtered ? t('locations.empty.filteredTitle') : t('locations.empty.title')}
        </Text>
        <Text c="dimmed" size="sm">
          {filtered ? t('locations.empty.filteredBody') : t('locations.empty.body')}
        </Text>
        {filtered ? (
          <Button mt="sm" variant="default" onClick={onClearFilters}>
            {t('table.clearFilters')}
          </Button>
        ) : (
          <Button color="accent" mt="sm" onClick={onCreate}>
            {t('locations.new')}
          </Button>
        )}
      </div>
    </div>
  )
}
