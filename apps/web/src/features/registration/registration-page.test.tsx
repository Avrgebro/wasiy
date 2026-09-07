import { MantineProvider } from '@mantine/core'
import { mantineTheme } from '../../app/theme'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistrationPage } from './registration-page'
import { ApiError } from '../../app/api-client'
import { completeRegistration, startRegistration, verifyRegistrationCode, type RegistrationPlan } from './api'
import type { MeResponse } from '../auth/types'

vi.mock('./api', () => ({ registrationCountries: [{ value: 'PE', label: 'Perú' }], startRegistration: vi.fn(), verifyRegistrationCode: vi.fn(), resendRegistrationCode: vi.fn(), completeRegistration: vi.fn(), getRegistrationPlans: vi.fn() }))
const catalog: RegistrationPlan[] = [
  { code: 'esencial', name: 'Esencial', unit_price_minor: 450, currency: 'PEN', features: [], location_limit: 1, included_units: 10 },
  { code: 'operativo', name: 'Operativo', unit_price_minor: 650, currency: 'PEN', features: [], location_limit: 1, included_units: 10 },
]
const draft = { first_name: 'Ana', last_name: 'Torres', email: 'ana@example.com', verified: false, resend_after: 30 }
const completed = vi.fn(async () => {})
function renderPage(initialPending = null as typeof draft | null) {
  return render(<MantineProvider theme={mantineTheme} env="test"><RegistrationPage initialPending={initialPending} catalog={catalog} onComplete={completed} /></MantineProvider>)
}
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(startRegistration).mockResolvedValue({ data: draft })
  vi.mocked(verifyRegistrationCode).mockResolvedValue({ data: { ...draft, verified: true } })
  vi.mocked(completeRegistration).mockResolvedValue({ session: { user: { id: 'new-user' } } as MeResponse })
})
async function accountStep(confirmation = 'test-password') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Nombre', { exact: true }), 'Ana')
  await user.type(screen.getByLabelText('Apellido'), 'Torres')
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
  await user.type(screen.getByLabelText('Contraseña', { exact: true }), 'test-password')
  await user.type(screen.getByLabelText('Confirmar contraseña'), confirmation)
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: /Crear cuenta/ }))
  return user
}
function enterCode(code: string) {
  code.split('').forEach((digit, index) => fireEvent.change(screen.getByLabelText(`Dígito ${index + 1}`), { target: { value: digit } }))
}

describe('Registration', () => {
  it('rejects mismatched passwords before sending credentials', async () => {
    renderPage()
    expect(screen.getByText('Plan elegido')).toBeInTheDocument()
    expect(screen.getByText('S/ 65')).toBeInTheDocument()
    expect(screen.getByText('Incluye hasta 10 unidades · S/ 6.50 por unidad adicional')).toBeInTheDocument()
    expect(screen.getByText('El favorito')).toBeInTheDocument()
    expect(screen.queryByText('Hoy', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('al indicar las unidades')).toBeInTheDocument()
    await accountStep('different-password')
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(startRegistration).not.toHaveBeenCalled()
  })
  it('shows server field errors under their input instead of the banner', async () => {
    vi.mocked(startRegistration).mockRejectedValue(new ApiError('Datos inválidos', 422, { email: ['Este correo ya tiene una cuenta. Inicia sesión.'] }))
    renderPage()
    await accountStep()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription(/ya tiene una cuenta/)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('uses backend OTP verification and preserves the email when correcting it', async () => {
    vi.mocked(verifyRegistrationCode).mockRejectedValue(new ApiError('Código incorrecto', 422, { code: ['El código no es correcto.'] }))
    renderPage()
    const user = await accountStep()
    expect(startRegistration).toHaveBeenCalledWith(expect.objectContaining({ password_confirmation: 'test-password', terms_accepted: true }))
    enterCode('111111')
    await user.click(screen.getByRole('button', { name: 'Confirmar correo' }))
    expect(verifyRegistrationCode).toHaveBeenCalledWith('111111')
    expect(screen.getByRole('alert')).toHaveTextContent('El código no es correcto')
    expect(screen.getByRole('button', { name: /Reenviar código en/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cambiar correo' }))
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com')
  })
  it('resumes verified onboarding and submits the chosen price and location', async () => {
    renderPage({ ...draft, verified: true })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nombre del edificio'), 'Edificio Central')
    await user.type(screen.getByLabelText('Dirección'), 'Av. Central 123')
    await user.type(screen.getByLabelText('Distrito'), 'San Isidro')
    expect(screen.getByLabelText('Ciudad')).toHaveValue('Lima')
    expect(screen.getByRole('combobox', { name: 'País' })).toHaveValue('Perú')
    await user.type(screen.getByLabelText('Número total de unidades'), '40')
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText('Hoy', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Av. Central 123, San Isidro, Lima · Perú')).toBeInTheDocument()
    expect(screen.getByText('Resumen')).toBeInTheDocument()
    const summary = screen.getByRole('complementary')
    expect(within(summary).getByText('S/ 260.00 al mes')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Esencial/ }))
    expect(within(summary).getByText('S/ 180.00 al mes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar edificio' }))
    expect(screen.getByLabelText('Nombre del edificio')).toHaveValue('Edificio Central')
    expect(screen.queryByText('Hoy', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('Total mensual')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.click(screen.getByRole('button', { name: 'Comenzar prueba gratis' }))
    expect(completeRegistration).toHaveBeenCalledWith({ name: 'Edificio Central', address: 'Av. Central 123', district: 'San Isidro', city: 'Lima', country: 'PE', units: 40, plan: 'esencial', unit_price_minor: 450 })
    expect(completed).toHaveBeenCalled()
  })
  it('keeps failed completion recoverable without reporting success', async () => {
    vi.mocked(completeRegistration).mockRejectedValue(new ApiError('No disponible', 503))
    renderPage({ ...draft, verified: true })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nombre del edificio'), 'Central')
    await user.type(screen.getByLabelText('Dirección'), 'Av. Central 123')
    await user.type(screen.getByLabelText('Distrito'), 'San Isidro')
    await user.type(screen.getByLabelText('Número total de unidades'), '40')
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.click(screen.getByRole('button', { name: 'Comenzar prueba gratis' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No disponible')
    expect(completed).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Comenzar prueba gratis' })).toBeEnabled()
  })
  it('shows the included units and adds nothing for a building under them', async () => {
    renderPage({ ...draft, verified: true })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nombre del edificio'), 'Chico')
    await user.type(screen.getByLabelText('Dirección'), 'Av. Central 123')
    await user.type(screen.getByLabelText('Distrito'), 'San Isidro')
    await user.type(screen.getByLabelText('Número total de unidades'), '6')
    const summary = screen.getByRole('complementary')
    expect(within(summary).getByText('Plan Operativo · hasta 10 unidades')).toBeInTheDocument()
    expect(within(summary).getAllByText('S/ 65.00')).toHaveLength(2)
    expect(within(summary).queryByText(/adicionales/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(within(screen.getByRole('complementary')).getByText('S/ 65.00 al mes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Comenzar prueba gratis' }))
    expect(completeRegistration).toHaveBeenCalledWith(expect.objectContaining({ units: 6, unit_price_minor: 650 }))
  })
})
