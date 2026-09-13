import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginPage from './page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/google-sign-in-button', () => ({
  GoogleSignInButton: ({ label }: { label: string }) => <button>{label}</button>,
}))

vi.mock('@/components/apple-sign-in-button', () => ({
  AppleSignInButton: ({ label, disabled }: { label: string; disabled?: boolean }) => (
    <button disabled={disabled}>{label}</button>
  ),
}))

import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const mockReplace = vi.fn()
vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never)
vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, dbUser: null, loading: false } as never)

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never)
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, dbUser: null, loading: false } as never)
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never)
  })

  it('shows session expired banner when reason=session_expired', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_expired') as never,
    )
    render(<LoginPage />)
    expect(screen.getByText('sessionExpired')).toBeInTheDocument()
  })

  it('does not show session expired banner without reason param', () => {
    render(<LoginPage />)
    expect(screen.queryByText('sessionExpired')).not.toBeInTheDocument()
  })

  it('renders sign-in buttons', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: 'google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'apple' })).toBeInTheDocument()
  })

  it('disables Apple sign-in and shows coming soon when the flag is unset', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: 'apple' })).toBeDisabled()
    expect(screen.getByText('appleComingSoon')).toBeInTheDocument()
  })

  it('disables Apple sign-in when the flag is set to anything but true', () => {
    vi.stubEnv('NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED', 'false')
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: 'apple' })).toBeDisabled()
    expect(screen.getByText('appleComingSoon')).toBeInTheDocument()
  })

  it('enables Apple sign-in and hides coming soon when the flag is true', () => {
    vi.stubEnv('NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED', 'true')
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: 'apple' })).toBeEnabled()
    expect(screen.queryByText('appleComingSoon')).not.toBeInTheDocument()
  })

  it('renders nothing while loading', () => {
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, dbUser: null, loading: true } as never)
    const { container } = render(<LoginPage />)
    expect(container.firstChild).toBeNull()
  })
})
