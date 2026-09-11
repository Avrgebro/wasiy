import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MoneyInput } from './money-input'

afterEach(cleanup)

function Harness({ initial, onChange }: { initial: number | null; onChange: (cents: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <MantineProvider env="test">
      <MoneyInput
        label="Monto"
        value={value}
        onChange={(cents) => {
          setValue(cents)
          onChange(cents)
        }}
      />
    </MantineProvider>
  )
}

describe('MoneyInput', () => {
  it('shows the currency as a left section and the stored cents as soles', () => {
    render(<Harness initial={125050} onChange={vi.fn()} />)

    expect(screen.getByText('S/')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Monto' })).toHaveValue('1 250.50')
  })

  it('emits integer cents for a decimal amount typed in soles', async () => {
    const onChange = vi.fn()
    render(<Harness initial={null} onChange={onChange} />)

    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Monto' }), '199.50')

    expect(onChange).toHaveBeenLastCalledWith(19950)
    expect(screen.getByRole('textbox', { name: 'Monto' })).toHaveValue('199.50')
  })

  it('emits null once the field is cleared', async () => {
    const onChange = vi.fn()
    render(<Harness initial={4200} onChange={onChange} />)

    await userEvent.setup().clear(screen.getByRole('textbox', { name: 'Monto' }))

    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
