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
import { fetchUpcomingTours } from './buddy.tour'
import { BookingStatusSchema, GroupTypeSchema, TourStatusSchema } from '@peace-buddy/types'
import type { BookingStatus, TourResponse } from '@peace-buddy/types'

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

  function mockTourWithBookings(statuses: Array<BookingStatus | null>) {
    const tour: TourResponse = {
      id: 'tour-1',
      groupId: 'group-1',
      group: { id: 'group-1', name: 'Test School', type: GroupTypeSchema.enum.school },
      status: TourStatusSchema.enum.published,
      tourDate: '2026-05-01T00:00:00.000Z',
      bookingOpen: true,
      location: 'Tokyo Station',
      participantCount: 0,
      description: null,
      cancellationDeadline: '2026-04-25T00:00:00.000Z',
      maybeDeadline: null,
      notificationOffsets: [],
      sessions: statuses.map((myBookingStatus, i) => ({
        id: `session-${i}`,
        order: i + 1,
        label: null,
        meetingTime: '1970-01-01T09:00:00.000Z',
        startTime: null,
        endTime: null,
        capacity: 10,
        minBuddies: null,
        participantCount: 0,
        belowMinimum: false,
        myBookingStatus,
      })),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    vi.mocked(fetchUpcomingTours).mockResolvedValueOnce({ ok: true, data: [tour] })
  }

  it("shows the buddy's own booking status on each session they are booked on", async () => {
    mockTourWithBookings([
      BookingStatusSchema.enum.confirmed,
      BookingStatusSchema.enum.maybe,
      BookingStatusSchema.enum.waitlist,
    ])
    mockStatus('active')
    render(<BuddyTourPage />)
    expect(await screen.findByText(BookingStatusSchema.enum.confirmed)).toBeInTheDocument()
    expect(screen.getByText(BookingStatusSchema.enum.maybe)).toBeInTheDocument()
    expect(screen.getByText(BookingStatusSchema.enum.waitlist)).toBeInTheDocument()
  })

  it('shows no booking status for a session not booked or declined', async () => {
    mockTourWithBookings([null, BookingStatusSchema.enum.declined])
    mockStatus('active')
    render(<BuddyTourPage />)
    expect(await screen.findByText('Test School')).toBeInTheDocument()
    for (const status of BookingStatusSchema.options) {
      expect(screen.queryByText(status)).not.toBeInTheDocument()
    }
  })

  it('shows no tour status badge, since every tour listed here is published', async () => {
    mockTourWithBookings([BookingStatusSchema.enum.confirmed])
    mockStatus('active')
    render(<BuddyTourPage />)
    expect(await screen.findByText(BookingStatusSchema.enum.confirmed)).toBeInTheDocument()
    expect(screen.queryByText(TourStatusSchema.enum.published)).not.toBeInTheDocument()
  })
})
