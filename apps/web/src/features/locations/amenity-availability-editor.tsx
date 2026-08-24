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
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <Text c="dimmed" size="xs">
          {t('amenities.availability.columns')}
        </Text>
        <Text c="dimmed" size="xs">
          {t('amenities.availability.timezoneNote', { timezone })}
        </Text>
      </div>
      <div className="flex flex-col divide-y divide-[var(--mantine-color-default-border)] rounded-xl border border-[var(--mantine-color-default-border)]">
        {WEEKDAYS.map((day) => {
          const windows = value[day] ?? []
          const conflict = findDayConflict(windows)
          const closed = windows.length === 0

          return (
            <div key={day} className={`flex flex-col gap-2 px-3.5 py-2.5 ${closed ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Text className="w-20 shrink-0" fw={600} size="sm">
                  {t(`amenities.weekdays.${day}`)}
                </Text>
                {closed ? (
                  <div className="flex items-center gap-3">
                    <Text c="dimmed" size="sm">
                      {t('amenities.availability.closed')}
                    </Text>
                    {readOnly ? null : (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => setDay(day, [{ start: '09:00', end: '22:00' }])}
                      >
                        {t('amenities.availability.openDay')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                    {windows.map((window, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <TextInput
                          aria-label={t('amenities.availability.startFor', {
                            day: t(`amenities.weekdays.${day}`),
                            n: index + 1,
                          })}
                          disabled={readOnly}
                          size="xs"
                          type="time"
                          value={window.start}
                          w={92}
                          onChange={(event) =>
                            setDay(
                              day,
                              windows.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, start: event.currentTarget.value } : item,
                              ),
                            )
                          }
                        />
                        <Text c="dimmed" size="xs">
                          {t('amenities.availability.to')}
                        </Text>
                        <TextInput
                          aria-label={t('amenities.availability.endFor', {
                            day: t(`amenities.weekdays.${day}`),
                            n: index + 1,
                          })}
                          disabled={readOnly}
                          size="xs"
                          type="time"
                          value={window.end}
                          w={92}
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
                            className="grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--mantine-color-dimmed)]"
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
                    {readOnly ? null : (
                      <div className="flex items-center gap-2">
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
                  </div>
                )}
              </div>
              {conflict ? (
                <div className="flex items-center gap-2 text-xs text-[var(--wa-error)]">
                  <DangerTriangle size={14} />
                  {conflict.end <= conflict.start
                    ? t('amenities.availability.inverted')
                    : t('amenities.availability.overlap', {
                        start: conflict.start,
                        end: conflict.end,
                      })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
