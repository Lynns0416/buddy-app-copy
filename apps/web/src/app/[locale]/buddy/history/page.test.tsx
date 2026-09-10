import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import BuddyHistoryPage from './page'
import type { MyTourBookingEntry } from '@peace-buddy/types'

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

import { useAuth } from '@/lib/auth'
import { useMyBookings } from '@/hooks/use-my-bookings'

const mockUseAuth = vi.mocked(useAuth)
const mockUseMyBookings = vi.mocked(useMyBookings)

const makeEntry = (overrides: Partial<MyTourBookingEntry> = {}): MyTourBookingEntry => ({
  tourId: 't1',
  tourDate: '2099-06-01T00:00:00.000Z',
  location: 'Tokyo Station',
  status: 'published',
  group: { name: 'Test School' },
  bookings: [{
    bookingId: 'b1',
    sessionId: 's1',
    sessionOrder: 1,
    sessionLabel: null,
    meetingTime: '1970-01-01T09:00:00.000Z',
    bookingStatus: 'confirmed',
    bookedAt: '2026-01-01T00:00:00.000Z',
  }],
  ...overrides,
})

describe('BuddyHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      firebaseUser: { uid: 'u1' } as never,
      dbUser: null,
      loading: false,
      signOut: vi.fn(),
      signInWithGoogle: vi.fn(),
      signInWithApple: vi.fn(),
      setBuddyProfile: vi.fn(),
    })
  })

  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), setBuddyProfile: vi.fn() })
    mockUseMyBookings.mockReturnValue({ bookings: null, error: false })
    const { container } = render(<BuddyHistoryPage />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while bookings are null', () => {
    mockUseMyBookings.mockReturnValue({ bookings: null, error: false })
    const { container } = render(<BuddyHistoryPage />)
    expect(container.firstChild).toBeNull()
  })

  it('shows empty state for both sections when no bookings', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [], error: false })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('noUpcoming')).toBeInTheDocument())
    expect(screen.getByText('noPast')).toBeInTheDocument()
  })

  it('places future tour in upcoming section', async () => {
    const entry = makeEntry({ tourDate: '2099-06-01T00:00:00.000Z' })
    mockUseMyBookings.mockReturnValue({ bookings: [entry], error: false })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
    expect(screen.queryByText('noUpcoming')).not.toBeInTheDocument()
    expect(screen.getByText('noPast')).toBeInTheDocument()
  })

  it('places past tour in past section', async () => {
    const entry = makeEntry({ tourDate: '2020-01-01T00:00:00.000Z' })
    mockUseMyBookings.mockReturnValue({ bookings: [entry], error: false })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
    expect(screen.getByText('noUpcoming')).toBeInTheDocument()
    expect(screen.queryByText('noPast')).not.toBeInTheDocument()
  })

  it('renders tour date and location', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [makeEntry()], error: false })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
    expect(screen.getByText(/2099-06-01/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo Station/)).toBeInTheDocument()
  })

  it('renders view link pointing to tour detail', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [makeEntry()], error: false })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'viewTour' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'viewTour' })).toHaveAttribute('href', '/en/buddy/tours/t1')
  })

  it('passes ready=true when auth is loaded and user exists', () => {
    mockUseMyBookings.mockReturnValue({ bookings: [], error: false })
    render(<BuddyHistoryPage />)
    expect(mockUseMyBookings).toHaveBeenCalledWith(true)
  })

  it('passes ready=false when loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), setBuddyProfile: vi.fn() })
    mockUseMyBookings.mockReturnValue({ bookings: null, error: false })
    render(<BuddyHistoryPage />)
    expect(mockUseMyBookings).toHaveBeenCalledWith(false)
  })
})
