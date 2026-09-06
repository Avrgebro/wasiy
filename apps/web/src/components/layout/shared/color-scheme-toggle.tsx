import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { MoonStarsIcon, Sun2Icon } from '@solar-icons/react/linear'
import { useTranslation } from 'react-i18next'

export function ColorSchemeToggle() {
  const { t } = useTranslation('common')
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: false,
  })
  const nextColorScheme = computedColorScheme === 'dark' ? 'light' : 'dark'
  const Icon = computedColorScheme === 'dark' ? Sun2Icon : MoonStarsIcon

  return (
    <Tooltip label={t(`theme.${nextColorScheme}`)}>
      <ActionIcon
        aria-label={t(`theme.${nextColorScheme}`)}
        onClick={() => setColorScheme(nextColorScheme)}
        size="lg"
        variant="subtle"
      >
        <Icon aria-hidden="true" size={18} />
      </ActionIcon>
    </Tooltip>
  )
}
