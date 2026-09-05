import { TextInput } from '@mantine/core'
import { Magnifier } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'

/**
 * Toolbar search box shared by the filter toolbars: uncontrolled, applies on
 * blur and on Enter. The URL search param is the source of truth, so the
 * current value only seeds the input.
 */
export function SearchInput({
  defaultValue,
  onApply,
  placeholder,
}: {
  defaultValue?: string
  onApply: (value: string) => void
  placeholder: string
}) {
  const { t } = useTranslation('common')

  return (
    <TextInput
      aria-label={t('actions.search')}
      className="w-full sm:w-64 lg:w-80"
      defaultValue={defaultValue}
      leftSection={<Magnifier size={15} />}
      placeholder={placeholder}
      onBlur={(event) => onApply(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onApply(event.currentTarget.value)
        }
      }}
    />
  )
}
