import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkedAccounts } from './linked-accounts'
import { GOOGLE_PROVIDER_ID, APPLE_PROVIDER_ID } from '@/lib/auth'

// Echoes the key, and any interpolated values after it, so assertions read as
// keys while still showing which provider an error was named for.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key,
}))

const linkProvider = vi.fn()
let linkedProviderIds: string[] = ['google.com']

// Provider ids come from the real module, not literals — a change to them must
// move the assertions below with it rather than leave them passing on stale values.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: () => ({ linkedProviderIds, linkProvider }),
}))

let appleEnabled = true
vi.mock('@/lib/flags', () => ({
  isAppleSignInEnabled: () => appleEnabled,
}))

describe('LinkedAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    linkedProviderIds = ['google.com']
    appleEnabled = true
  })

  it('offers the Apple link when only Google is connected', () => {
    render(<LinkedAccounts />)
    expect(screen.getByRole('button', { name: 'connectApple' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'connectGoogle' })).not.toBeInTheDocument()
  })

  it('offers the Google link when only Apple is connected', () => {
    linkedProviderIds = ['apple.com']
    render(<LinkedAccounts />)
    expect(screen.getByRole('button', { name: 'connectGoogle' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'connectApple' })).not.toBeInTheDocument()
  })

  it('shows both as connected once linked, with no button left', () => {
    linkedProviderIds = ['google.com', 'apple.com']
    render(<LinkedAccounts />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getAllByText('connected')).toHaveLength(2)
  })

  it('disables the Apple link while the provider is flag-gated off', () => {
    appleEnabled = false
    render(<LinkedAccounts />)
    expect(screen.getByRole('button', { name: 'connectApple' })).toBeDisabled()
    expect(screen.getByText('comingSoon')).toBeInTheDocument()
  })

  it('links the provider that was clicked', async () => {
    linkProvider.mockResolvedValueOnce(undefined)
    render(<LinkedAccounts />)

    await userEvent.click(screen.getByRole('button', { name: 'connectApple' }))

    expect(linkProvider).toHaveBeenCalledWith(APPLE_PROVIDER_ID)
  })

  it('links Google when the Google button is the one clicked', async () => {
    linkedProviderIds = ['apple.com']
    linkProvider.mockResolvedValueOnce(undefined)
    render(<LinkedAccounts />)

    await userEvent.click(screen.getByRole('button', { name: 'connectGoogle' }))

    expect(linkProvider).toHaveBeenCalledWith(GOOGLE_PROVIDER_ID)
  })

  it('reports the duplicate-account case when the credential belongs to another user', async () => {
    linkProvider.mockRejectedValueOnce({ code: 'auth/credential-already-in-use' })
    render(<LinkedAccounts />)

    await userEvent.click(screen.getByRole('button', { name: 'connectApple' }))

    expect(screen.getByText('error.alreadyInUse(apple)')).toBeInTheDocument()
  })

  // Firebase picks this code instead when the project is one-account-per-email
  // and the address, rather than the provider subject, is what already exists.
  it('reports the duplicate-account case when the address belongs to another user', async () => {
    linkProvider.mockRejectedValueOnce({ code: 'auth/email-already-in-use' })
    render(<LinkedAccounts />)

    await userEvent.click(screen.getByRole('button', { name: 'connectApple' }))

    expect(screen.getByText('error.alreadyInUse(apple)')).toBeInTheDocument()
  })

  it('names the clicked provider, not Apple, when the Google link is the duplicate', async () => {
    linkedProviderIds = [APPLE_PROVIDER_ID]
    linkProvider.mockRejectedValueOnce({ code: 'auth/credential-already-in-use' })
    render(<LinkedAccounts />)

    await userEvent.click(screen.getByRole('button', { name: 'connectGoogle' }))

    expect(screen.getByText('error.alreadyInUse(google)')).toBeInTheDocument()
  })

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
    'stays silent when the buddy dismisses the popup (%s)',
    async (code) => {
      linkProvider.mockRejectedValueOnce({ code })
      render(<LinkedAccounts />)

      await userEvent.click(screen.getByRole('button', { name: 'connectApple' }))

      expect(screen.queryByText('error.unknown')).not.toBeInTheDocument()
      expect(screen.queryByText('error.alreadyInUse(apple)')).not.toBeInTheDocument()
    }
  )

  it('reports an unrecognised failure', async () => {
    linkProvider.mockRejectedValueOnce({ code: 'auth/network-request-failed' })
    render(<LinkedAccounts />)

    await userEvent.click(screen.getByRole('button', { name: 'connectApple' }))

    expect(screen.getByText('error.unknown')).toBeInTheDocument()
  })

  it('re-enables the button after a failed attempt', async () => {
    linkProvider.mockRejectedValueOnce({ code: 'auth/network-request-failed' })
    render(<LinkedAccounts />)

    await userEvent.click(screen.getByRole('button', { name: 'connectApple' }))

    expect(screen.getByRole('button', { name: 'connectApple' })).toBeEnabled()
  })
})
