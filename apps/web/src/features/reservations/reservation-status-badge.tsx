import { Tooltip } from '@mantine/core'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusPill } from '../../components/ui/chips'
import type { ReservationSummary } from './api'
import { reservationStatusColor, reservationStatusKey } from './reservation-presentation'

export function ReservationStatusBadge({ reservation }: { reservation: Pick<ReservationSummary, 'status' | 'is_completed'> }) {
  const { t } = useTranslation('common')
  const [opened, setOpened] = useState(false)
  const descriptionId = useId()
  const status = reservationStatusKey(reservation)
  return (
    <Tooltip opened={opened} label={t(`reservations.statusDescriptions.${status}`)} multiline w={260} withArrow>
      <StatusPill
        component="button"
        type="button"
        aria-label={t(`reservations.statuses.${status}`)}
        aria-describedby={descriptionId}
        color={reservationStatusColor(status)}
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
      </StatusPill>
    </Tooltip>
  )
}
