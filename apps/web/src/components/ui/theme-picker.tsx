import { useMantineColorScheme, type MantineColorScheme } from '@mantine/core'
import { MonitorIcon, MoonStarsIcon, Sun2Icon } from '@solar-icons/react/linear'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'

const CHOICES: { value: MantineColorScheme; icon: ComponentType<{ size?: number }>; labelKey: string }[] = [
  { value: 'light', icon: Sun2Icon, labelKey: 'theme.choiceLight' },
  { value: 'dark', icon: MoonStarsIcon, labelKey: 'theme.choiceDark' },
  { value: 'auto', icon: MonitorIcon, labelKey: 'theme.choiceSystem' },
]

/**
 * Three cells, icon over label (mockups 20 and 21). A radio group by hand:
 * Mantine's SegmentedControl cannot stack an icon over its label.
 * `size` picks the desktop menu cell or the taller touch cell.
 */
export function ThemePicker({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { t } = useTranslation('common')
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const compact = size === 'md'

  return (
    <div
      aria-label={t('theme.label')}
      className={`grid grid-cols-3 rounded-[10px] border border-[var(--mantine-color-default-border)] bg-[var(--wa-field)] ${compact ? 'gap-1 p-1' : 'gap-[5px] p-[5px]'}`}
      role="radiogroup"
    >
      {CHOICES.map(({ value, icon: Icon, labelKey }) => {
        const active = colorScheme === value
        return (
          <button
            key={value}
            aria-checked={active}
            className={`flex flex-col items-center justify-center rounded-[7px] border-0 bg-transparent font-medium transition-colors ${
              compact ? 'gap-[5px] py-2 text-[11px]' : 'h-[62px] gap-1.5 text-xs'
            } ${
              active
                ? 'bg-[var(--wa-tint)] font-semibold text-[var(--mantine-color-text)] shadow-[inset_0_0_0_1px_var(--mantine-color-teal-4)]'
                : 'text-[var(--mantine-color-dimmed)] hover:bg-[var(--mantine-color-default-hover)]'
            }`}
            onClick={() => setColorScheme(value)}
            role="radio"
            type="button"
          >
            <Icon aria-hidden="true" size={compact ? 16 : 19} />
            {t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}
