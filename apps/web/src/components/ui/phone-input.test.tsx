import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { formatPhone } from '../../lib/phone'
import { PhoneInput } from './phone-input'

afterEach(cleanup)

function renderInput(value = '', country = 'PE') {
  const onChange = vi.fn()
  render(
    <MantineProvider env="test">
      <PhoneInput defaultCountry={country} label="Teléfono" value={value} onChange={onChange} />
    </MantineProvider>,
  )
  return onChange
}

describe('PhoneInput', () => {
  it('switches country from the left-section picker and re-emits', async () => {
    const onChange = renderInput('+51987654321')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'País' }))
    await user.type(screen.getByPlaceholderText('Buscar país…'), 'chile')
    await user.click(await screen.findByRole('option', { name: /Chile/ }))

    expect(screen.getByRole('button', { name: 'País' })).toHaveTextContent('🇨🇱+56')
    expect(onChange).toHaveBeenLastCalledWith('+56987654321')
  })

  it('emits E.164 for a national number typed in the location country', async () => {
    const onChange = renderInput()
    const user = userEvent.setup()

    expect(screen.getByRole('button', { name: 'País' })).toHaveTextContent('🇵🇪+51')
    await user.type(screen.getByRole('textbox', { name: 'Teléfono' }), '987654321')

    expect(onChange).toHaveBeenLastCalledWith('+51987654321')
  })

  it('seeds the selector and national digits from a stored value', () => {
    renderInput('+56987654321')

    expect(screen.getByRole('button', { name: 'País' })).toHaveTextContent('🇨🇱+56')
    expect(screen.getByRole('textbox', { name: 'Teléfono' })).toHaveValue('9 8765 4321')
  })
})

describe('formatPhone', () => {
  it('reads nationally at home and internationally abroad', () => {
    expect(formatPhone('+51987654321', 'PE')).toBe('987 654 321')
    expect(formatPhone('+51987654321', 'CL')).toBe('+51 987 654 321')
    expect(formatPhone('999-100-100', 'PE')).toBe('999-100-100')
    expect(formatPhone(null, 'PE')).toBe('')
  })
})
