import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from './app-shell'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: () => ({ locale: 'en' }),
  usePathname: () => '/en/buddy',
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const mockPush = vi.fn()
vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never)

const mockSignOut = vi.fn()
vi.mocked(useAuth).mockReturnValue({ signOut: mockSignOut } as never)

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never)
    mockSignOut.mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ signOut: mockSignOut } as never)
  })

  it('renders children', () => {
    render(<AppShell variant="buddy"><div>content</div></AppShell>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('shows tour, history and profile for an active buddy', () => {
    vi.mocked(useAuth).mockReturnValue({
      signOut: mockSignOut,
      dbUser: { buddyProfile: { status: 'active' } },
    } as never)
    render(<AppShell variant="buddy"><div /></AppShell>)
    expect(screen.getAllByRole('link', { name: 'nav.home' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'nav.history' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'nav.profile' })[0]).toBeInTheDocument()
  })

  it('shows profile only for a trainee buddy', () => {
    vi.mocked(useAuth).mockReturnValue({
      signOut: mockSignOut,
      dbUser: { buddyProfile: { status: 'trainee' } },
    } as never)
    render(<AppShell variant="buddy"><div /></AppShell>)
    expect(screen.getAllByRole('link', { name: 'nav.profile' })[0]).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'nav.home' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'nav.history' })).not.toBeInTheDocument()
  })

  it('calls signOut and redirects to login on sign-out click', async () => {
    render(<AppShell variant="buddy"><div /></AppShell>)
    const buttons = screen.getAllByRole('button', { name: 'signOut' })
    buttons[0].click()
    await vi.waitFor(() => expect(mockSignOut).toHaveBeenCalled())
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith('/en/login'))
  })
})
