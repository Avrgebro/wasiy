import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResidentInvitationPage } from './resident-invitation-page'
import { apiClient } from '../../app/api-client'
import '../../i18n'

const navigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}))

const originalAdapter = apiClient.defaults.adapter

function renderPage(token = 'tok_valid') {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <ResidentInvitationPage token={token} />
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

const invitationPayload = {
  data: {
    id: 'inv_1',
    email: 'lucia.paz@wasiy.test',
    status: 'pending',
    purpose: 'resident',
    expires_at: '2026-08-10T00:00:00Z',
    resident: { id: 'res_1', name: 'Lucia Paz', status: 'active' },
    account: { id: 'acc_1', name: 'Wasiy Demo' },
  },
}

function sessionPayload() {
  return {
    user: {
      id: 'usr_1',
      first_name: 'Lucia',
      last_name: 'Paz',
      name: 'Lucia Paz',
      email: 'lucia.paz@wasiy.test',
    },
    accounts: [],
    active_account: null,
    active_location: null,
    locations: [],
    roles: { account: [], location: [] },
    resident_memberships: [{ id: 'mem_1' }],
  }
}

afterEach(() => {
  cleanup()
  navigate.mockReset()
  apiClient.defaults.adapter = originalAdapter
})

describe('ResidentInvitationPage', () => {
  it('renders the account and resident from the invitation lookup', async () => {
    apiClient.defaults.adapter = vi.fn(async (config) =>
      axiosResponse(config, invitationPayload),
    ) as unknown as AxiosAdapter

    renderPage()

    expect(
      await screen.findByText(/portal de residentes de Wasiy Demo como Lucia Paz/i),
    ).toBeInTheDocument()
  })

  it('signs the resident in and routes to the portal on a successful claim', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = vi.fn(async (config) => {
      if (config.method?.toLowerCase() === 'post') {
        return axiosResponse(config, {
          data: {
            resident: { id: 'res_1' },
            invitation: { id: 'inv_1', status: 'accepted' },
            session: sessionPayload(),
          },
        })
      }

      return axiosResponse(config, invitationPayload)
    }) as unknown as AxiosAdapter

    renderPage()

    await screen.findByText(/portal de residentes de Wasiy Demo/i)

    await user.type(screen.getByLabelText(/Crea una contraseña/i), 'super-secret-1')
    await user.type(
      screen.getByLabelText(/Confirma la contraseña/i),
      'super-secret-1',
    )
    await user.click(screen.getByRole('button', { name: /Activar acceso/i }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/portal' })
    })
  })

  it('sends the resident to sign in when the claim returns no session', async () => {
    const user = userEvent.setup()

    apiClient.defaults.adapter = vi.fn(async (config) => {
      if (config.method?.toLowerCase() === 'post') {
        return axiosResponse(config, {
          data: {
            resident: { id: 'res_1' },
            invitation: { id: 'inv_1', status: 'accepted' },
            session: null,
          },
        })
      }

      return axiosResponse(config, invitationPayload)
    }) as unknown as AxiosAdapter

    renderPage()

    await screen.findByText(/portal de residentes de Wasiy Demo/i)

    await user.type(screen.getByLabelText(/Crea una contraseña/i), 'super-secret-1')
    await user.type(
      screen.getByLabelText(/Confirma la contraseña/i),
      'super-secret-1',
    )
    await user.click(screen.getByRole('button', { name: /Activar acceso/i }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/login' })
    })
  })

  it('renders the unavailable state for a spent or expired token', async () => {
    apiClient.defaults.adapter = vi.fn((config) =>
      Promise.reject(
        new AxiosError(
          'Gone',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          axiosResponse(config, { message: 'Gone' }, 410),
        ),
      ),
    ) as unknown as AxiosAdapter

    renderPage('tok_expired')

    expect(
      await screen.findByText(/Invitación no disponible/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Activar acceso/i }),
    ).not.toBeInTheDocument()
  })

  it('rejects a mismatched password confirmation before calling the API', async () => {
    const user = userEvent.setup()
    const adapter = vi.fn(async (config) =>
      axiosResponse(config, invitationPayload),
    )
    apiClient.defaults.adapter = adapter as unknown as AxiosAdapter

    renderPage()

    await screen.findByText(/portal de residentes de Wasiy Demo/i)

    await user.type(screen.getByLabelText(/Crea una contraseña/i), 'super-secret-1')
    await user.type(screen.getByLabelText(/Confirma la contraseña/i), 'different-1')
    await user.click(screen.getByRole('button', { name: /Activar acceso/i }))

    expect(await screen.findByText(/Las contraseñas no coinciden/i)).toBeInTheDocument()
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.method?.toLowerCase() === 'post',
      ),
    ).toHaveLength(0)
  })
})
