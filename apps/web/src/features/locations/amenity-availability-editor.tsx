import { Button, Text, TextInput } from '@mantine/core'
import { AddCircle, CloseCircle, Copy, DangerTriangle } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import type { Availability, AvailabilityWindow } from './amenities-api'
import { findDayConflict, WEEKDAYS, type Weekday } from './amenity-schedule'

/**
 * The weekday editor from mockup 06c: one row per day holding zero or more
 * open/close windows. Zero windows renders the day dimmed with an "open"
 * shortcut; overlaps validate as you type and the drawer blocks saving
 * until resolved. Times are in the location's timezone.
 */
export function AmenityAvailabilityEditor({
  onChange,
  readOnly,
  timezone,
  value,
}: {
  onChange: (next: Availability) => void
  readOnly: boolean
  timezone: string
  value: Availability
}) {
  const { t } = useTranslation('common')

  function setDay(day: Weekday, windows: AvailabilityWindow[]) {
    onChange({ ...value, [day]: windows })
  }

  function copyToAllDays(day: Weekday) {
    const source = value[day] ?? []
    onChange(Object.fromEntries(WEEKDAYS.map((weekday) => [weekday, source.map((window) => ({ ...window }))])))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <Text c="dimmed" size="xs">
          {t('amenities.availability.columns')}
        </Text>
        <Text c="dimmed" size="xs">
          {t('amenities.availability.timezoneNote', { timezone })}
        </Text>
      </div>
      <div className="flex flex-col divide-y divide-[var(--mantine-color-default-border)] overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)]">
        {WEEKDAYS.map((day) => {
          const windows = value[day] ?? []
          const conflict = findDayConflict(windows)
          const closed = windows.length === 0

          return (
            <div
              key={day}
              className={`flex flex-col gap-2.5 p-3 sm:flex-row sm:items-start sm:gap-4 sm:px-3.5 sm:py-2.5 ${
                closed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between sm:w-20 sm:shrink-0 sm:pt-1.5">
                <Text fw={600} size="sm">
                  {t(`amenities.weekdays.${day}`)}
                </Text>
                {closed ? (
                  <Text c="dimmed" size="xs" className="sm:hidden">
                    {t('amenities.availability.closed')}
                  </Text>
                ) : null}
              </div>

              {closed ? (
                <div className="flex items-center gap-3 sm:pt-1">
                  <Text c="dimmed" size="sm" className="hidden sm:inline">
                    {t('amenities.availability.closed')}
                  </Text>
                  {readOnly ? null : (
                    <Button
                      leftSection={<AddCircle size={13} />}
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => setDay(day, [{ start: '09:00', end: '22:00' }])}
                    >
                      {t('amenities.availability.openDay')}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-2">
                    {windows.map((window, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <TextInput
                          aria-label={t('amenities.availability.startFor', {
                            day: t(`amenities.weekdays.${day}`),
                            n: index + 1,
                          })}
                          className="flex-1 min-w-0 max-w-[170px] sm:max-w-[150px]"
                          disabled={readOnly}
                          size="xs"
                          type="time"
                          value={window.start}
                          onChange={(event) =>
                            setDay(
                              day,
                              windows.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, start: event.currentTarget.value } : item,
                              ),
                            )
                          }
                        />
                        <Text c="dimmed" size="xs" className="shrink-0">
                          {t('amenities.availability.to')}
                        </Text>
                        <TextInput
                          aria-label={t('amenities.availability.endFor', {
                            day: t(`amenities.weekdays.${day}`),
                            n: index + 1,
                          })}
                          className="flex-1 min-w-0 max-w-[170px] sm:max-w-[150px]"
                          disabled={readOnly}
                          size="xs"
                          type="time"
                          value={window.end}
                          onChange={(event) =>
                            setDay(
                              day,
                              windows.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, end: event.currentTarget.value } : item,
                              ),
                            )
                          }
                        />
                        {readOnly ? null : (
                          <button
                            aria-label={t('amenities.availability.removeWindow', {
                              day: t(`amenities.weekdays.${day}`),
                            })}
                            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-[var(--mantine-color-dimmed)] transition-colors hover:text-[var(--wa-error)]"
                            type="button"
                            onClick={() =>
                              setDay(day, windows.filter((_, itemIndex) => itemIndex !== index))
                            }
                          >
                            <CloseCircle size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {readOnly ? null : (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Button
                        leftSection={<AddCircle size={13} />}
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => setDay(day, [...windows, { start: '', end: '' }])}
                      >
                        {t('amenities.availability.addWindow')}
                      </Button>
                      <Button
                        leftSection={<Copy size={13} />}
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => copyToAllDays(day)}
                      >
                        {t('amenities.availability.copyToAll')}
                      </Button>
                    </div>
                  )}
                  {conflict ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--wa-error)]">
                      <DangerTriangle size={14} className="shrink-0" />
                      <span>
                        {conflict.end <= conflict.start
                          ? t('amenities.availability.inverted')
                          : t('amenities.availability.overlap', {
                              start: conflict.start,
                              end: conflict.end,
                            })}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
