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

afterEach(() => {
  cleanup()
  navigate.mockReset()
  apiClient.defaults.adapter = originalAdapter
})

describe('StaffInvitationPage', () => {
  it('shows the granted access and the inviter', async () => {
    apiClient.defaults.adapter = vi.fn(async (config) =>
      axiosResponse(config, invitation(true)),
    ) as unknown as AxiosAdapter

    renderPage()

    expect(
      await screen.findByText(/Mariana Rojas te invitó a formar parte del equipo de Wasiy Demo/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Edificio Central — Portería/i)).toBeInTheDocument()
  })

  it('collects a password when the invitee has no account yet', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = vi.fn(async (config) => {
      if (config.method?.toLowerCase() === 'post') {
        return axiosResponse(config, {
          data: { skipped_location_ids: [], session: sessionPayload() },
        })
      }

      return axiosResponse(config, invitation(true))
    }) as unknown as AxiosAdapter

    renderPage()

    await screen.findByText(/equipo de Wasiy Demo/i)

    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Nueva')
    await user.type(screen.getByLabelText(/Crea una contraseña/i), 'super-secret-1')
    await user.type(
      screen.getByLabelText(/Confirma la contraseña/i),
      'super-secret-1',
    )
    await user.click(
      screen.getByRole('button', { name: /Aceptar invitación/i }),
    )

    // front_desk lands on the front-desk surface.
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/front-desk' })
    })
  })

  it('asks an existing user to confirm rather than sign up', async () => {
    apiClient.defaults.adapter = vi.fn(async (config) =>
      axiosResponse(config, invitation(false)),
    ) as unknown as AxiosAdapter

    renderPage()

    await screen.findByText(/equipo de Wasiy Demo/i)

    expect(
      screen.getByRole('button', { name: /Aceptar invitación/i }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Crea una contraseña/i)).not.toBeInTheDocument()
  })

  it('offers sign-in when accepting returns unauthorized', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = vi.fn((config) => {
      if (config.method?.toLowerCase() === 'post') {
        return rejectWith(config, 401)
      }

      return Promise.resolve(axiosResponse(config, invitation(false)))
    }) as unknown as AxiosAdapter

    renderPage()

    await screen.findByText(/equipo de Wasiy Demo/i)
    await user.click(
      screen.getByRole('button', { name: /Aceptar invitación/i }),
    )

    expect(
      await screen.findByText(/Inicia sesión para continuar/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ingresar como nueva@wasiy.test/i }),
    ).toBeInTheDocument()
  })

  it('explains the mismatch when signed in as someone else', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = vi.fn((config) => {
      if (config.method?.toLowerCase() === 'post') {
        return rejectWith(config, 409)
      }

      return Promise.resolve(axiosResponse(config, invitation(false)))
    }) as unknown as AxiosAdapter

    renderPage()

    await screen.findByText(/equipo de Wasiy Demo/i)
    await user.click(
      screen.getByRole('button', { name: /Aceptar invitación/i }),
    )

    expect(
      await screen.findByText(/Iniciaste sesión con otra cuenta/i),
    ).toBeInTheDocument()

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
  })
})
