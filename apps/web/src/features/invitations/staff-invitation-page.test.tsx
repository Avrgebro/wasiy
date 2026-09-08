import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffInvitationPage } from './staff-invitation-page'
import { apiClient } from '../../app/api-client'
import '../../i18n'

const navigate = vi.fn()
const notifyWarning = vi.fn()

vi.mock('../../lib/notify', () => ({
  notifyWarning: (...args: unknown[]) => notifyWarning(...args),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}))

const originalAdapter = apiClient.defaults.adapter
const TOKEN = 'tok_staff'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <StaffInvitationPage token={TOKEN} />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

function axiosResponse(
  config: AxiosResponse['config'],
  data: unknown,
  status = 200,
): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: status === 200 ? 'OK' : 'Error',
  }
}

function invitation(requiresAccountCreation: boolean) {
  return {
    data: {
      email: 'nueva@wasiy.test',
      first_name: 'Nueva',
      last_name: 'Persona',
      expires_at: '2026-08-10T00:00:00Z',
      requires_account_creation: requiresAccountCreation,
      account: { id: 'acc_1', name: 'Wasiy Demo' },
      invited_by: { name: 'Mariana Rojas' },
      roles: {
        account_role: null,
        locations: [{ name: 'Edificio Central', role: 'front_desk' }],
      },
    },
  }
}

function sessionPayload() {
  return {
    user: {
      id: 'usr_1',
      first_name: 'Nueva',
      last_name: 'Persona',
      name: 'Nueva Persona',
      email: 'nueva@wasiy.test',
    },
    accounts: [{ id: 'acc_1', name: 'Wasiy Demo' }],
    active_account: { id: 'acc_1', name: 'Wasiy Demo' },
    active_location: null,
    locations: [],
    roles: { account: [], location: [{ role: 'front_desk' }] },
    resident_memberships: [],
  }
}

function rejectWith(config: AxiosResponse['config'], status: number) {
  return Promise.reject(
    new AxiosError(
      'Error',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      axiosResponse(config, { message: '' }, status),
    ),
  )
}

/**
 * Routes the three requests the page makes: the invitation lookup, the
 * session probe (/api/me) and the accept POST. `me` is the session payload,
 * a status number for a rejected probe, or omitted for an anonymous visitor.
 */
function adapterFor({
  accept,
  me = 401,
  requiresAccountCreation,
}: {
  accept?: unknown | { reject: number }
  me?: ReturnType<typeof sessionPayload> | number
  requiresAccountCreation: boolean
}): AxiosAdapter {
  return vi.fn((config) => {
    if (config.url?.endsWith('/api/me')) {
      return typeof me === 'number' ? rejectWith(config, me) : Promise.resolve(axiosResponse(config, me))
    }

    if (config.method?.toLowerCase() === 'post') {
      if (accept && typeof accept === 'object' && 'reject' in accept) {
        return rejectWith(config, (accept as { reject: number }).reject)
      }

      return Promise.resolve(axiosResponse(config, accept ?? { data: { skipped_location_ids: [], session: sessionPayload() } }))
    }

    return Promise.resolve(axiosResponse(config, invitation(requiresAccountCreation)))
  }) as unknown as AxiosAdapter
}

afterEach(() => {
  cleanup()
  navigate.mockReset()
  notifyWarning.mockReset()
  apiClient.defaults.adapter = originalAdapter
})

describe('StaffInvitationPage', () => {
  it('shows the granted access, the inviter and the expiry', async () => {
    apiClient.defaults.adapter = adapterFor({ requiresAccountCreation: true })

    renderPage()

    expect(
      await screen.findByText(/Mariana Rojas te invitó a formar parte del equipo de Wasiy Demo/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Edificio Central')).toBeInTheDocument()
    expect(screen.getByText('Portería')).toBeInTheDocument()
    expect(screen.getByText(/Este enlace vence el/i)).toBeInTheDocument()
  })

  it('collects a password when the invitee has no account yet', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = adapterFor({ requiresAccountCreation: true })

    renderPage()

    await screen.findByText(/equipo de Wasiy Demo/i)

    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Nueva')
    expect(screen.getByText(/asociado a nueva@wasiy.test/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Crea una contraseña/i), 'super-secret-1')
    await user.type(
      screen.getByLabelText(/Confirma la contraseña/i),
      'super-secret-1',
    )
    await user.click(
      screen.getByRole('button', { name: /Aceptar invitación/i }),
    )

    // front_desk lands on the shared admin surface.
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ href: '/admin' })
    })
    expect(notifyWarning).not.toHaveBeenCalled()
  })

  it('warns when the accept dropped a location that no longer exists', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = adapterFor({
      accept: { data: { skipped_location_ids: ['loc_gone'], session: sessionPayload() } },
      me: sessionPayload(),
      requiresAccountCreation: false,
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Aceptar invitación/i }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ href: '/admin' })
    })
    expect(notifyWarning).toHaveBeenCalledWith(expect.stringMatching(/ya no existe/i))
  })

  it('asks a signed-in invitee to confirm rather than sign up', async () => {
    apiClient.defaults.adapter = adapterFor({ me: sessionPayload(), requiresAccountCreation: false })

    renderPage()

    expect(
      await screen.findByRole('button', { name: /Aceptar invitación/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Aceptarás como nueva@wasiy.test/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Crea una contraseña/i)).not.toBeInTheDocument()
  })

  it('offers sign-in up front when the invitee has an account but no session', async () => {
    apiClient.defaults.adapter = adapterFor({ requiresAccountCreation: false })

    renderPage()

    expect(
      await screen.findByText(/Inicia sesión para continuar/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ingresar como nueva@wasiy.test/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aceptar invitación/i })).not.toBeInTheDocument()
  })

  it('falls back to the sign-in state when the accept itself returns unauthorized', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = adapterFor({
      accept: { reject: 401 },
      me: sessionPayload(),
      requiresAccountCreation: false,
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Aceptar invitación/i }))

    expect(
      await screen.findByText(/Inicia sesión para continuar/i),
    ).toBeInTheDocument()
  })

  it('blocks the sign-up form while someone else is signed in', async () => {
    apiClient.defaults.adapter = adapterFor({
      me: { ...sessionPayload(), user: { ...sessionPayload().user, email: 'otra@wasiy.test' } },
      requiresAccountCreation: true,
    })

    renderPage()

    expect(
      await screen.findByText(/Iniciaste sesión con otra cuenta/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Crea una contraseña/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ingresar como nueva@wasiy.test/i }),
    ).toBeInTheDocument()
  })

  it('explains the mismatch up front when signed in as someone else', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = adapterFor({
      me: { ...sessionPayload(), user: { ...sessionPayload().user, email: 'otra@wasiy.test' } },
      requiresAccountCreation: false,
    })

    renderPage()

    expect(
      await screen.findByText(/Iniciaste sesión con otra cuenta/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/iniciaste sesión como otra@wasiy.test/i)).toBeInTheDocument()

    // Signing out and returning to /login must preserve the token to come back to.
    await user.click(
      screen.getByRole('button', { name: /Ingresar como nueva@wasiy.test/i }),
    )

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: '/login',
        search: { redirect: `/invitations/staff/${TOKEN}` },
      })
    })
  })

  it('renders the unavailable state for a spent token', async () => {
    apiClient.defaults.adapter = vi.fn((config) =>
      rejectWith(config, 410),
    ) as unknown as AxiosAdapter

    renderPage()

    expect(
      await screen.findByText(/Invitación no disponible/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ingresar/i })).toHaveAttribute('href', '/login')
  })
})
