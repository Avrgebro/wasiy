import { NumberInput, Text, type NumberInputProps } from '@mantine/core'

type MoneyInputProps = {
  /** Amount in cents (minor units); `null` while the field is empty. */
  value: number | null
  onChange: (cents: number | null) => void
} & Pick<NumberInputProps, 'label' | 'description' | 'error' | 'placeholder' | 'disabled' | 'required' | 'className' | 'name' | 'onBlur'>

/**
 * Money field for PEN: the user types soles with up to two decimals, the
 * form and the API hold integer cents (199.50 → 19950), never a float.
 * "S/" sits in the left section as dimmed text so the input itself is only
 * the number — no mask to fight while typing.
 */
export function MoneyInput({ value, onChange, ...rest }: MoneyInputProps) {
  return (
    <NumberInput
      {...rest}
      allowNegative={false}
      decimalScale={2}
      fixedDecimalScale
      hideControls
      inputMode="decimal"
      leftSection={
        <Text c="dimmed" size="sm">
          S/
        </Text>
      }
      thousandSeparator=" "
      value={value === null ? '' : value / 100}
      onChange={(next) => onChange(toCents(next))}
    />
  )
}

function toCents(value: number | string): number | null {
  const soles = typeof value === 'number' ? value : value.trim() === '' ? NaN : Number(value)

  return Number.isFinite(soles) ? Math.round(soles * 100) : null
}
