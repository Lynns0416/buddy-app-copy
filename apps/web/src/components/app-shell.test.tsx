import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AppShell } from './app-shell'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: () => ({ locale: 'en' }),
  usePathname: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
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

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const mockPush = vi.fn()
vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never)

const mockSignOut = vi.fn()
vi.mocked(useAuth).mockReturnValue({ signOut: mockSignOut } as never)

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never)
    vi.mocked(usePathname).mockReturnValue('/en/buddy')
    mockSignOut.mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ signOut: mockSignOut } as never)
  })

  it('renders children', () => {
    render(<AppShell variant="buddy"><div>content</div></AppShell>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('shows tour, history, record and profile for an active buddy', () => {
    vi.mocked(useAuth).mockReturnValue({
      signOut: mockSignOut,
      dbUser: { buddyProfile: { status: 'active' } },
    } as never)
    render(<AppShell variant="buddy"><div /></AppShell>)
    expect(screen.getAllByRole('link', { name: 'nav.home' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'nav.history' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'nav.record' })[0]).toBeInTheDocument()
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
    expect(screen.queryByRole('link', { name: 'nav.record' })).not.toBeInTheDocument()
  })

  it('calls signOut and redirects to login on sign-out click', async () => {
    render(<AppShell variant="buddy"><div /></AppShell>)
    const buttons = screen.getAllByRole('button', { name: 'signOut' })
    buttons[0].click()
    await vi.waitFor(() => expect(mockSignOut).toHaveBeenCalled())
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith('/en/login'))
  })

  describe('admin', () => {
    function renderAdmin(role: 'admin' | 'super_admin', pathname = '/en/admin') {
      vi.mocked(usePathname).mockReturnValue(pathname)
      vi.mocked(useAuth).mockReturnValue({ signOut: mockSignOut, dbUser: { role } } as never)
      render(<AppShell variant="admin"><div /></AppShell>)
    }

    it('groups work links under labelled sections', () => {
      renderAdmin('admin')
      const tours = screen.getAllByRole('group', { name: 'nav.sections.tours' })[0]
      expect(within(tours).getByRole('link', { name: 'nav.tours' })).toBeInTheDocument()
      expect(within(tours).getByRole('link', { name: 'nav.groups' })).toBeInTheDocument()
      expect(within(tours).getByRole('link', { name: 'nav.places' })).toBeInTheDocument()
      const buddies = screen.getAllByRole('group', { name: 'nav.sections.buddies' })[0]
      expect(within(buddies).getByRole('link', { name: 'nav.buddiesPending' })).toBeInTheDocument()
      expect(within(buddies).getByRole('link', { name: 'nav.buddies' })).toBeInTheDocument()
      expect(within(buddies).getByRole('link', { name: 'nav.trainees' })).toBeInTheDocument()
      const stats = screen.getAllByRole('group', { name: 'nav.sections.stats' })[0]
      expect(within(stats).getByRole('link', { name: 'nav.buddyStats' })).toHaveAttribute('href', '/en/admin/stats/buddies')
      expect(within(stats).getByRole('link', { name: 'nav.reflectionStats' })).toHaveAttribute('href', '/en/admin/stats/reflections')
    })

    it('puts personal items in the account nav, without the roster for admin', () => {
      renderAdmin('admin')
      const account = screen.getAllByRole('navigation', { name: 'nav.accountLabel' })[0]
      expect(within(account).getByRole('link', { name: 'nav.adminProfile' })).toBeInTheDocument()
      expect(within(account).getByRole('link', { name: 'nav.adminNotificationPreferences' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'nav.adminRoster' })).not.toBeInTheDocument()
    })

    it('shows the roster in the account nav for super_admin', () => {
      renderAdmin('super_admin')
      const account = screen.getAllByRole('navigation', { name: 'nav.accountLabel' })[0]
      expect(within(account).getByRole('link', { name: 'nav.adminRoster' })).toBeInTheDocument()
    })

    it('marks only the longest matching link as the current page', () => {
      renderAdmin('admin', '/en/admin/buddies/pending')
      const [pending] = screen.getAllByRole('link', { name: 'nav.buddiesPending' })
      const [buddies] = screen.getAllByRole('link', { name: 'nav.buddies' })
      const [home] = screen.getAllByRole('link', { name: 'nav.home' })
      expect(pending).toHaveAttribute('aria-current', 'page')
      expect(buddies).not.toHaveAttribute('aria-current')
      expect(home).not.toHaveAttribute('aria-current')
    })

    it('marks an account link as the current page on its sub-route', () => {
      renderAdmin('admin', '/en/admin/profile')
      const [profile] = screen.getAllByRole('link', { name: 'nav.adminProfile' })
      expect(profile).toHaveAttribute('aria-current', 'page')
    })
  })
})
