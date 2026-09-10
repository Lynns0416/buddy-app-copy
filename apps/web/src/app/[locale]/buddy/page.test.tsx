import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BuddyTourPage from './page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
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

vi.mock('@/lib/api-client', () => ({
  apiClient: { markOnboardingSeen: vi.fn() },
}))

import { useAuth } from '../../../lib/auth'
import { apiClient } from '@/lib/api-client'
import { routes } from '@/lib/routes'

const setBuddyProfile = vi.fn()

// Buddies in these tests have already been sent to their profile once, unless a
// test says otherwise — that is the steady state the page renders in.
function mockStatus(status: string, onboardingSeenAt: string | null = '2026-01-01T00:00:00.000Z') {
  vi.mocked(useAuth).mockReturnValue({
    firebaseUser: { uid: 'u1' },
    dbUser: { buddyProfile: { status, onboardingSeenAt } },
    loading: false,
    setBuddyProfile,
  } as never)
}

describe('BuddyTourPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends an approved buddy who has not been to their profile yet', async () => {
    vi.mocked(apiClient.markOnboardingSeen).mockResolvedValue({ onboardingSeenAt: 'now' } as never)
    mockStatus('trainee', null)

    render(<BuddyTourPage />)

    expect(replace).toHaveBeenCalledWith(routes.buddyProfileOnboarding('en'))
    await vi.waitFor(() => expect(apiClient.markOnboardingSeen).toHaveBeenCalled())
    expect(setBuddyProfile).toHaveBeenCalled()
  })

  it('sends an active buddy who has not been to their profile yet', () => {
    vi.mocked(apiClient.markOnboardingSeen).mockResolvedValue({} as never)
    mockStatus('active', null)

    render(<BuddyTourPage />)

    expect(replace).toHaveBeenCalledWith(routes.buddyProfileOnboarding('en'))
  })

  it('leaves a buddy on the tour list once the visit is stamped', () => {
    mockStatus('active')

    render(<BuddyTourPage />)

    expect(replace).not.toHaveBeenCalled()
    expect(apiClient.markOnboardingSeen).not.toHaveBeenCalled()
  })

  it('sends a pending buddy to the pending page, not to onboarding', () => {
    mockStatus('pending', null)

    render(<BuddyTourPage />)

    expect(replace).toHaveBeenCalledWith(routes.pending('en'))
    expect(apiClient.markOnboardingSeen).not.toHaveBeenCalled()
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
