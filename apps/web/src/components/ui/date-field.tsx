import { DatePickerInput, type DatePickerInputProps } from '@mantine/dates'
import { CalendarIcon } from '@solar-icons/react/linear'
import { useTranslation } from 'react-i18next'

export type DateFieldProps = Omit<DatePickerInputProps<'default'>, 'type' | 'value' | 'onChange' | 'defaultValue'> & {
  /** `YYYY-MM-DD`, or '' when empty — the shape forms and the API already use. */
  value: string
  onChange: (value: string) => void
}

/**
 * The app's date picker: Mantine's DatePickerInput speaking wall-clock
 * strings, with a calendar icon, Spanish long value ("5 de octubre de 2026")
 * and the day buttons labelled by ISO date so tests and screen readers can
 * address a day unambiguously. Bounds and closed days come in as props
 * (minDate / maxDate / excludeDate).
 */
export function DateField({ value, onChange, ...props }: DateFieldProps) {
  const { t } = useTranslation('common')

  return (
    <DatePickerInput
      getDayAriaLabel={(date) => date}
      nextLabel={t('dates.nextMonth')}
      previousLabel={t('dates.previousMonth')}
      leftSection={<CalendarIcon aria-hidden="true" size={18} />}
      popoverProps={{ withinPortal: true }}
      valueFormat="D [de] MMMM [de] YYYY"
      {...props}
      value={value === '' ? null : value}
      onChange={(next) => onChange(next ?? '')}
    />
  )
}
