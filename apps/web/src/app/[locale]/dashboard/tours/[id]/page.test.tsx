import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TourDetailPage from './page'
import type { TourDetailResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ locale: 'en', id: 'tour-1' }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/routes', () => ({
  routes: { dashboard: (locale: string) => `/${locale}/dashboard` },
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { getTour: vi.fn() },
}))

import { useAuth } from '@/lib/auth'
import { apiClient } from '@/lib/api-client'

const mockUseAuth = vi.mocked(useAuth)
const mockGetTour = vi.mocked(apiClient.getTour)

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'buddy' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  buddyProfile: null,
}

const mockFirebaseUser = { uid: 'uid-123' } as never

const mockTour: TourDetailResponse = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: '2026-05-01T00:00:00.000Z',
  meetingTime: '1970-01-01T09:00:00.000Z',
  startTime: null,
  endTime: null,
  bookingOpen: true,
  location: 'Tokyo Station',
  capacity: 10,
  description: 'A guided tour',
  cancellationDeadline: '2026-04-28T00:00:00.000Z',
  maybeDeadline: null,
  notificationOffsets: [3, 1],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  seatCounts: { confirmed: 3, maybe: 1, waitlist: 2, declined: 0 },
  remainingSeats: 7,
  myBookingStatus: null,
}

describe('TourDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      firebaseUser: mockFirebaseUser,
      dbUser: mockDbUser,
      loading: false,
      signOut: vi.fn(),
      signInWithGoogle: vi.fn(),
      signInWithApple: vi.fn(),
    })
  })

  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn() })
    mockGetTour.mockResolvedValue(mockTour)
    const { container } = render(<TourDetailPage />)
    expect(container.firstChild).toBeNull()
  })

  it('shows not found message when API throws', async () => {
    mockGetTour.mockRejectedValue(new Error('Not found'))
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('notFound')).toBeInTheDocument())
  })

  it('renders group name and location', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
    expect(screen.getByText('Tokyo Station')).toBeInTheDocument()
  })

  it('renders description', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('A guided tour')).toBeInTheDocument())
  })

  it('renders seat counts', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('seatCounts')).toBeInTheDocument())
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders remaining seats', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument())
  })

  it('shows noBooking when myBookingStatus is null', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, myBookingStatus: null })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('noBooking')).toBeInTheDocument())
  })

  it.each([
    ['confirmed', 'statusConfirmed'],
    ['maybe', 'statusMaybe'],
    ['waitlist', 'statusWaitlist'],
    ['declined', 'statusDeclined'],
  ] as const)('shows %s booking status label', async (status, labelKey) => {
    mockGetTour.mockResolvedValue({ ...mockTour, myBookingStatus: status })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText(labelKey)).toBeInTheDocument())
  })

  it('passes tour id from params to getTour', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(mockGetTour).toHaveBeenCalledWith('tour-1'))
  })
})
