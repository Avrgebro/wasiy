import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import '../../i18n'
import { mantineTheme } from '../../app/theme'
import { sessionQueryKey } from '../auth/query-options'
import type { MeResponse, Session } from '../auth/types'
import { AccountPage } from './account-page'

const mocks = vi.hoisted(() => ({
  api: {
    updateProfile: vi.fn(), changePassword: vi.fn(), getEmailChange: vi.fn(), requestEmailChange: vi.fn(), resendEmailChange: vi.fn(),
    verifyEmailChange: vi.fn(), cancelEmailChange: vi.fn(), getSessions: vi.fn(), closeOtherSessions: vi.fn(),
  },
}))
vi.mock('./api', () => mocks.api)
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode; [key: string]: unknown }) => <a href={to} {...props}>{children}</a>,
}))

const account = { id: 'acc_1', name: 'Administradora Sur SAC', slug: 'sur', timezone: 'America/Lima', locations_count: 2, active_locations_count: 2, subscription: null, access: { account_role: null, locations: [{ location_id: 'loc_1', location_name: 'Edificio Central', role: 'location_manager' as const }, { location_id: 'loc_2', location_name: 'Torre Norte', role: 'front_desk' as const }] } }
const me: MeResponse = {
  user: { id: 'usr_1', first_name: 'Ana', last_name: 'Torres', name: 'Ana Torres', email: 'ana.torres@wasiy.pe' },
  accounts: [account, { ...account, id: 'acc_2', name: 'Condominio Las Palmas', access: { account_role: 'account_admin' as const, locations: [] } }],
  active_account: account,
  active_location: null,
  roles: { account: [], location: [{ account_id: 'acc_1', location_id: 'loc_1', role: 'location_manager' }, { account_id: 'acc_1', location_id: 'loc_2', role: 'front_desk' }] },
  accessible_locations: [
    { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'central', timezone: 'America/Lima', country: 'PE', address: null, roles: ['location_manager'], capabilities: [], access_source: 'location_role' },
    { id: 'loc_2', account_id: 'acc_1', name: 'Torre Norte', slug: 'norte', timezone: 'America/Lima', country: 'PE', address: null, roles: ['front_desk'], capabilities: [], access_source: 'location_role' },
  ],
  resident_memberships: [],
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const session: Session = { status: 'authenticated', me }
  queryClient.setQueryData(sessionQueryKey, session)
  render(
    <MantineProvider defaultColorScheme="auto" env="test" theme={mantineTheme}>
      <QueryClientProvider client={queryClient}>
        <AccountPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

const card = (title: string) => screen.getByRole('heading', { level: 2, name: title }).closest('section')!

describe('AccountPage', () => {
  it('shows identity, accesses per location and the theme picker', async () => {
    mocks.api.getEmailChange.mockResolvedValue({ data: null })
    mocks.api.getSessions.mockResolvedValue({ data: [] })
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument()
    expect(within(card('Identidad')).getByText('ana.torres@wasiy.pe')).toBeInTheDocument()
    // Location and role are separate spans; match on the row's full text.
    const accessRows = within(card('Cuentas y accesos')).getAllByRole('listitem').map((li) => li.textContent)
    expect(accessRows).toEqual(expect.arrayContaining(['Edificio Central · Administrador', 'Torre Norte · Portería', 'Toda la cuenta · Superadmin']))
    expect(screen.getByRole('link', { name: 'Cambiar cuenta' })).toHaveAttribute('href', '/select-account')
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
  })

  it('enables Guardar cambios only once a field changes and confirms inline', async () => {
    mocks.api.getEmailChange.mockResolvedValue({ data: null })
    mocks.api.getSessions.mockResolvedValue({ data: [] })
    mocks.api.updateProfile.mockResolvedValue({ data: { ...me.user, first_name: 'Ana María', name: 'Ana María Torres' } })
    renderPage()
    const user = userEvent.setup()

    const save = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Nombre'), ' María')
    expect(save).toBeEnabled()
    await user.click(save)
    // Mutation functions get (variables, context); assert on the variables.
    await waitFor(() => expect(mocks.api.updateProfile.mock.calls[0]?.[0]).toEqual({ first_name: 'Ana María', last_name: 'Torres' }))
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument()
  })

  it('changes the email in two steps inside the card', async () => {
    mocks.api.getEmailChange.mockResolvedValue({ data: null })
    mocks.api.getSessions.mockResolvedValue({ data: [] })
    mocks.api.requestEmailChange.mockResolvedValue({ data: { email: 'ana.torres@gmail.com', resend_after: 30 } })
    mocks.api.verifyEmailChange.mockResolvedValue({ data: { ...me.user, email: 'ana.torres@gmail.com' } })
    renderPage()
    const user = userEvent.setup()

    const email = card('Correo de acceso')
    await user.click(within(email).getByRole('button', { name: 'Cambiar correo' }))
    expect(within(email).getByText('Paso 1 de 2')).toBeInTheDocument()
    await user.type(within(email).getByLabelText('Contraseña actual'), 'safe-password')
    await user.type(within(email).getByLabelText('Correo nuevo'), 'ana.torres@gmail.com')
    await user.click(within(email).getByRole('button', { name: 'Enviar código' }))

    expect(await screen.findByText('Paso 2 de 2')).toBeInTheDocument()
    expect(mocks.api.requestEmailChange.mock.calls[0]?.[0]).toEqual({ current_password: 'safe-password', email: 'ana.torres@gmail.com' })
    expect(screen.getByRole('button', { name: 'Reenviar código en 30s' })).toBeDisabled()
    for (let i = 1; i <= 6; i++) await user.type(screen.getByLabelText(`Dígito ${i}`), String(i))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(mocks.api.verifyEmailChange.mock.calls[0]?.[0]).toBe('123456'))
    expect(await screen.findByText('Correo actualizado hace un momento')).toBeInTheDocument()
  })

  it('lists sessions, flags the current one and closes the others with the password', async () => {
    mocks.api.getEmailChange.mockResolvedValue({ data: null })
    mocks.api.getSessions.mockResolvedValue({ data: [
      { id: 'a', device: 'Mac · Chrome', ip_address: '190.117.24.8', last_active_at: new Date().toISOString(), is_current: true },
      { id: 'b', device: 'iPhone · Safari', ip_address: '190.117.24.9', last_active_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), is_current: false },
    ] })
    mocks.api.closeOtherSessions.mockResolvedValue(undefined)
    renderPage()
    const user = userEvent.setup()

    const sessions = card('Sesiones activas')
    await within(sessions).findByText('Mac · Chrome')
    const mac = within(sessions).getByText('Mac · Chrome').closest('li')!
    expect(within(mac).getByText('Esta sesión')).toBeInTheDocument()
    expect(within(sessions).getByText(/iPhone · Safari/)).toBeInTheDocument()
    expect(within(sessions).getByText(/hace 3 h/)).toBeInTheDocument()

    await user.click(within(sessions).getByRole('button', { name: 'Cerrar las demás sesiones' }))
    await user.type(within(sessions).getByLabelText('Contraseña actual'), 'safe-password')
    await user.click(within(sessions).getByRole('button', { name: 'Cerrar las demás sesiones' }))
    await waitFor(() => expect(mocks.api.closeOtherSessions.mock.calls[0]?.[0]).toEqual({ current_password: 'safe-password' }))
    expect(await screen.findByText('Las demás sesiones se cerraron')).toBeInTheDocument()
  })
})
