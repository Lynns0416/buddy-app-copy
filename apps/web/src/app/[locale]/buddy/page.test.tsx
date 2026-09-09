import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BuddyTourPage from './page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('../../../lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./buddy.tour', () => ({
  fetchUpcomingTours: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}))

import { useAuth } from '../../../lib/auth'

function mockStatus(status: string) {
  vi.mocked(useAuth).mockReturnValue({
    firebaseUser: { uid: 'u1' },
    dbUser: { buddyProfile: { status } },
    loading: false,
  } as never)
}

describe('BuddyTourPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tells a trainee they are in training, not unregistered', () => {
    mockStatus('trainee')
    render(<BuddyTourPage />)
    expect(screen.getByText('traineeMessage')).toBeInTheDocument()
    expect(screen.queryByText('notRegistered')).not.toBeInTheDocument()
  })

  it('tells a rejected buddy they are not registered', () => {
    mockStatus('rejected')
    render(<BuddyTourPage />)
    expect(screen.getByText('notRegistered')).toBeInTheDocument()
  })

  it('renders the tour list for an active buddy', async () => {
    mockStatus('active')
    render(<BuddyTourPage />)
    expect(await screen.findByText('noTours')).toBeInTheDocument()
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.queryByText('traineeMessage')).not.toBeInTheDocument()
  })
})
