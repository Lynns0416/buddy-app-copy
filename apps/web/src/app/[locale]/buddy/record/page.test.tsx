import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import BuddyRecordPage from './page'
import type { MyTourBookingEntry, TourReflectionResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ locale: 'en' }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-my-bookings', () => ({
  useMyBookings: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { listMyReflections: vi.fn() },
}))

import { useAuth } from '@/lib/auth'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { apiClient } from '@/lib/api-client'

const mockUseAuth = vi.mocked(useAuth)
const mockUseMyBookings = vi.mocked(useMyBookings)
const mockListMyReflections = vi.mocked(apiClient.listMyReflections)

const entry = (overrides: Partial<MyTourBookingEntry> = {}): MyTourBookingEntry => ({
  tourId: 't1',
  tourDate: '2026-01-10T00:00:00.000Z',
  places: [{ id: 'place-1', nameJa: '長崎', nameEn: 'Nagasaki' }],
  status: 'completed',
  maybeDeadline: null,
  reflectionSubmitted: false,
  group: { name: 'Test School', type: 'school' },
  bookings: [{
    bookingId: 'b1',
    sessionId: 's1',
    sessionOrder: 1,
    sessionLabel: null,
    meetingTime: '1970-01-01T09:00:00.000Z',
    startTime: '1970-01-01T09:30:00.000Z',
    endTime: '1970-01-01T12:00:00.000Z',
    place: { id: 'place-1', nameJa: '長崎', nameEn: 'Nagasaki' },
    bookingStatus: 'confirmed',
    bookedAt: '2026-01-01T00:00:00.000Z',
  }],
  ...overrides,
})

const reflection = (overrides: Partial<TourReflectionResponse> = {}): TourReflectionResponse => ({
  id: 'r1',
  buddyId: 'buddy-1',
  sessionId: 's1',
  sessionOrder: 1,
  sessionLabel: null,
  tourId: 't1',
  didWell: null,
  couldImprove: null,
  notesForOthers: null,
  openQuestions: 'When was it built?',
  moments: [],
  createdAt: '2026-01-11T00:00:00.000Z',
  updatedAt: '2026-01-11T00:00:00.000Z',
  locked: true,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ firebaseUser: {}, loading: false } as never)
})

describe('BuddyRecordPage', () => {
  it('shows the empty state when the buddy has attended no tour', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [], error: false, reload: vi.fn() })
    mockListMyReflections.mockResolvedValue([])
    render(<BuddyRecordPage />)
    expect(await screen.findByText('empty')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'last.title' })).not.toBeInTheDocument()
  })

  it('shows the last tour, milestones, questions and totals once the buddy has attended a tour', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [entry()], error: false, reload: vi.fn() })
    mockListMyReflections.mockResolvedValue([])
    render(<BuddyRecordPage />)
    for (const name of ['last.title', 'milestones.title', 'questions.title', 'totals.title']) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'note.title' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'moments.title' })).not.toBeInTheDocument()
  })

  it('links a completed last tour without a reflection to its reflection page', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [entry()], error: false, reload: vi.fn() })
    mockListMyReflections.mockResolvedValue([])
    render(<BuddyRecordPage />)
    expect(await screen.findByRole('link', { name: 'last.write' })).toHaveAttribute('href', '/en/buddy/tours/t1/reflection')
  })

  it('lists an open question as a link to its reflection', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [entry({ reflectionSubmitted: true })], error: false, reload: vi.fn() })
    mockListMyReflections.mockResolvedValue([reflection()])
    render(<BuddyRecordPage />)
    expect(await screen.findByRole('link', { name: /When was it built\?/ })).toHaveAttribute('href', '/en/buddy/tours/t1/reflection')
  })

  it('shows at most five milestones until "show all" is pressed', async () => {
    const bookings = Array.from({ length: 7 }, (_, i) =>
      entry({ tourId: `t${i}`, tourDate: `2026-0${i + 1}-01T00:00:00.000Z`, reflectionSubmitted: true, group: { name: 'Test School', type: 'school' } }),
    )
    // Each tour after the first at a new place makes a milestone: 1 first tour + 6 first places.
    bookings.forEach((b, i) => { b.bookings[0].place = { id: `p${i}`, nameJa: `P${i}`, nameEn: `P${i}` } })
    mockUseMyBookings.mockReturnValue({ bookings, error: false, reload: vi.fn() })
    mockListMyReflections.mockResolvedValue([])
    render(<BuddyRecordPage />)
    const region = await screen.findByRole('region', { name: 'milestones.title' })
    expect(within(region).getAllByRole('listitem')).toHaveLength(5)
    fireEvent.click(within(region).getByRole('button', { name: 'showAll' }))
    expect(within(region).getAllByRole('listitem').length).toBeGreaterThan(5)
  })

  it('shows a load error when the reflections fail to load', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [entry()], error: false, reload: vi.fn() })
    mockListMyReflections.mockRejectedValue(new Error('boom'))
    render(<BuddyRecordPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('loadError')
  })
})
