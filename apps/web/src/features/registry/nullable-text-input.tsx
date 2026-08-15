import { TextInput } from '@mantine/core'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { fieldErrorMessage } from '../../lib/errors'

/**
 * Text input for nullable string form fields: renders null as '' and turns
 * '' back into null on change.
 */
export function NullableTextInput<T extends FieldValues>({
  control,
  label,
  name,
}: {
  control: Control<T>
  label: string
  name: Path<T>
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextInput
          {...field}
          value={(field.value as string | null) ?? ''}
          error={fieldErrorMessage(fieldState.error)}
          label={label}
          onChange={(event) => field.onChange(event.currentTarget.value || null)}
        />
      )}
    />
  )
}
