import { Button, Text } from '@mantine/core'
import { UsersGroupRounded } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'

/**
 * Two flavors: filtered searches get a plain "no results", a genuinely empty
 * account gets the onboarding call to action.
 */
export function StaffEmptyState({
  filtered,
  onInvite,
}: {
  filtered: boolean
  onInvite: () => void
}) {
  const { t } = useTranslation('common')

  return (
    <div className="grid min-h-72 place-items-center p-6 text-center sm:p-10">
      <div className="flex flex-col items-center gap-2">
        <UsersGroupRounded className="text-[var(--mantine-color-dimmed)]" size={28} />
        <Text fw={700}>{filtered ? t('staff.empty.filteredTitle') : t('staff.empty.title')}</Text>
        <Text c="dimmed" size="sm">
          {filtered ? t('staff.empty.filteredBody') : t('staff.empty.body')}
        </Text>
        {filtered ? null : (
          <Button color="accent" mt="sm" onClick={onInvite}>
            {t('staff.invite')}
          </Button>
        )}
      </div>
    </div>
  )
}
