import { Badge, Tooltip } from '@mantine/core'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReservationSummary } from './api'

const COLORS = { pending: 'warning', approved: 'success', observed: 'info', rejected: 'error', cancelled: 'gray', completed: 'gray' }

export function ReservationStatusBadge({ reservation, variant = 'light' }: { variant?: 'light' | 'surface'; reservation: Pick<ReservationSummary, 'status' | 'is_completed'> }) {
  const { t } = useTranslation('common')
  const [opened, setOpened] = useState(false)
  const descriptionId = useId()
  const status = reservation.is_completed ? 'completed' : reservation.status
  return (
    <Tooltip opened={opened} label={t(`reservations.statusDescriptions.${status}`)} multiline w={260} withArrow>
      <Badge
        component="button"
        type="button"
        aria-label={t(`reservations.statuses.${status}`)}
        aria-describedby={descriptionId}
        color={COLORS[status]}
        radius="xl"
        size="sm"
        variant={variant}
        className="cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
        onMouseEnter={() => setOpened(true)}
        onMouseLeave={() => setOpened(false)}
        onFocus={() => setOpened(true)}
        onBlur={() => setOpened(false)}
        onClick={(event) => { event.stopPropagation(); setOpened(true) }}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') setOpened(false)
        }}
      >
        {t(`reservations.statuses.${status}`)}
        <span id={descriptionId} className="sr-only">{t(`reservations.statusDescriptions.${status}`)}</span>
      </Badge>
    </Tooltip>
  )
}
