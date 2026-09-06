import { ActionIcon, Button, Group, Popover, SimpleGrid, Text } from '@mantine/core'
import { AltArrowDownIcon, AltArrowLeftIcon, AltArrowRightIcon } from '@solar-icons/react/linear'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { monthLabel, shiftMonth } from './month'

export function MonthNavigation({ month, thisMonth, onChange }: {
  month: string
  thisMonth: string
  onChange: (month: string | undefined) => void
}) {
  const { t, i18n } = useTranslation('common')
  const [opened, setOpened] = useState(false)
  const [year, setYear] = useState(Number(month.slice(0, 4)))
  const currentYear = Number(thisMonth.slice(0, 4))
  const locale = i18n.resolvedLanguage ?? i18n.language
  const label = monthLabel(month, locale)

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Group className="w-full sm:w-auto" gap={6} wrap="nowrap">
        <ActionIcon aria-label={t('finances.previousMonth')} radius="md" size={44} variant="default" onClick={() => onChange(shiftMonth(month, -1))}>
          <AltArrowLeftIcon size={16} />
        </ActionIcon>
        <Popover opened={opened} onChange={setOpened} position="bottom" width={288} shadow="md" trapFocus returnFocus>
          <Popover.Target>
            <Button
              aria-expanded={opened}
              aria-haspopup="dialog"
              className="min-w-0 flex-1 capitalize sm:min-w-44"
              h={44}
              rightSection={<AltArrowDownIcon size={14} />}
              variant="default"
              onClick={() => { setYear(Number(month.slice(0, 4))); setOpened(!opened) }}
            >
              {label}
            </Button>
          </Popover.Target>
          <Popover.Dropdown aria-labelledby="" aria-label={t('finances.chooseMonth')}>
            <Group justify="space-between" mb="sm" wrap="nowrap">
              <ActionIcon aria-label={t('finances.previousYear')} size={44} variant="subtle" onClick={() => setYear(year - 1)}>
                <AltArrowLeftIcon size={16} />
              </ActionIcon>
              <Text fw={600} aria-live="polite">{year}</Text>
              <ActionIcon aria-label={t('finances.nextYear')} disabled={year >= currentYear} size={44} variant="subtle" onClick={() => setYear(year + 1)}>
                <AltArrowRightIcon size={16} />
              </ActionIcon>
            </Group>
            <SimpleGrid cols={3} spacing={6}>
              {Array.from({ length: 12 }, (_, index) => {
                const value = `${year}-${String(index + 1).padStart(2, '0')}`
                const name = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
                return (
                  <Button
                    key={value}
                    aria-label={monthLabel(value, locale)}
                    aria-pressed={value === month}
                    className="capitalize"
                    disabled={value > thisMonth}
                    h={44}
                    px={4}
                    variant={value === month ? 'light' : 'subtle'}
                    onClick={() => { onChange(value === thisMonth ? undefined : value); setOpened(false) }}
                  >{name}</Button>
                )
              })}
            </SimpleGrid>
          </Popover.Dropdown>
        </Popover>
        <ActionIcon aria-label={t('finances.nextMonth')} disabled={month >= thisMonth} radius="md" size={44} variant="default" onClick={() => onChange(shiftMonth(month, 1))}>
          <AltArrowRightIcon size={16} />
        </ActionIcon>
      </Group>
      <Button disabled={month === thisMonth} h={44} variant="default" onClick={() => onChange(undefined)}>
        {t('finances.currentMonth')}
      </Button>
    </div>
  )
}
