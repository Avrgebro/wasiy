import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../app/api-client'
import { mantineTheme } from '../../app/theme'
import { getPendingLoginCode, requestLoginCode, verifyLoginCode } from './api'
import { LoginCodeForm } from './login-code-form'
import { sessionQueryKey } from './query-options'
import type { MeResponse } from './types'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  getPendingLoginCode: vi.fn(),
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
}))

const me = { user: { id: 'u1', email: 'ana@example.com' } } as unknown as MeResponse

function renderForm(remember = true) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  const onSuccess = vi.fn()
  const onBack = vi.fn()
  const onRememberChange = vi.fn()
  render(
    <MantineProvider env="test" theme={mantineTheme}>
      <QueryClientProvider client={queryClient}>
        <LoginCodeForm onBack={onBack} onRememberChange={onRememberChange} onSuccess={onSuccess} remember={remember} />
      </QueryClientProvider>
    </MantineProvider>,
  )
  return { onBack, onRememberChange, onSuccess, queryClient }
}

function typeCode(code: string) {
  code.split('').forEach((digit, index) => fireEvent.change(screen.getByLabelText(`Dígito ${index + 1}`), { target: { value: digit } }))
}

beforeEach(() => {
  vi.mocked(getPendingLoginCode).mockResolvedValue({ data: null })
  vi.mocked(requestLoginCode).mockResolvedValue({ data: { email: 'ana@example.com', resend_after: 30 } })
  vi.mocked(verifyLoginCode).mockResolvedValue({ session: me })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LoginCodeForm', () => {
  it('requests a code for the email, verifies it with remember, and seeds the session', async () => {
    const user = userEvent.setup()
    const { onSuccess, queryClient } = renderForm()

    await user.type(await screen.findByLabelText('Correo electrónico'), 'Ana@Example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))

    expect(requestLoginCode).toHaveBeenCalledWith('Ana@Example.com')
    expect(await screen.findByText(/Enviamos un código a ana@example.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reenviar código en 30s/ })).toBeDisabled()

    const submit = screen.getByRole('button', { name: 'Ingresar' })
    expect(submit).toBeDisabled()
    typeCode('482913')
    await user.click(submit)

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(me))
    expect(verifyLoginCode).toHaveBeenCalledWith({ code: '482913', remember: true })
    expect(queryClient.getQueryData(sessionQueryKey)).toEqual({ status: 'authenticated', me })
  })

  it('shows server errors under the field and lets the user change the email', async () => {
    const user = userEvent.setup()
    vi.mocked(verifyLoginCode).mockRejectedValueOnce(new ApiError('Inválido', 422, { code: ['El código no es correcto. Inténtalo otra vez.'] }))
    const { onSuccess } = renderForm(false)

    await user.click(await screen.findByRole('button', { name: 'Enviar código' }))
    expect(screen.getByText('Ingresa tu correo.')).toBeInTheDocument()
    expect(requestLoginCode).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    await screen.findByText(/Enviamos un código/)

    typeCode('000000')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es correcto')
    expect(verifyLoginCode).toHaveBeenCalledWith({ code: '000000', remember: false })
    expect(onSuccess).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cambiar correo' }))
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com')
  })

  it('resumes on the code step when this session already has an outstanding code', async () => {
    const user = userEvent.setup()
    vi.mocked(getPendingLoginCode).mockResolvedValue({ data: { email: 'ana@example.com', resend_after: 12 } })
    const { onSuccess } = renderForm()

    expect(await screen.findByText(/Enviamos un código a ana@example.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reenviar código en 12s/ })).toBeDisabled()
    expect(requestLoginCode).not.toHaveBeenCalled()

    typeCode('482913')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(me))

    await user.click(screen.getByRole('button', { name: 'Cambiar correo' }))
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com')
  })
})
