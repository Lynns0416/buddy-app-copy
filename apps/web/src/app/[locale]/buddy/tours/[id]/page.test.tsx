import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TourDetailPage from './page'
import type { TourDetailResponse, TourSessionDetailResponse } from '@peace-buddy/types'

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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  SelectValue: () => null,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, id, rows }: { value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; id?: string; rows?: number }) => (
    <textarea value={value} onChange={onChange} id={id} rows={rows} />
  ),
}))

vi.mock('@/lib/routes', () => ({
  routes: { buddy: (locale: string) => `/${locale}/buddy` },
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { getTour: vi.fn(), createBooking: vi.fn(), updateBooking: vi.fn() },
}))

import { useAuth } from '@/lib/auth'
import { apiClient } from '@/lib/api-client'

const mockUseAuth = vi.mocked(useAuth)
const mockGetTour = vi.mocked(apiClient.getTour)
const mockCreateBooking = vi.mocked(apiClient.createBooking)
const mockUpdateBooking = vi.mocked(apiClient.updateBooking)

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'buddy' as const,
  locale: 'ja' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  buddyProfile: null,
}

const mockFirebaseUser = { uid: 'uid-123' } as never

const mockSession: TourSessionDetailResponse = {
  id: 'session-1',
  order: 1,
  label: null,
  meetingTime: '1970-01-01T09:00:00.000Z',
  startTime: null,
  endTime: null,
  capacity: 10,
  minBuddies: null,
  participantCount: 0,
  belowMinimum: false,
  seatCounts: { confirmed: 3, maybe: 1, waitlist: 2, declined: 0 },
  remaining: 7,
  myCapacity: 7,
  myRemaining: 5,
  myBookingStatus: null,
}

const mockTour: TourDetailResponse = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: '2026-05-01T00:00:00.000Z',
  bookingOpen: true,
  location: 'Tokyo Station',
  participantCount: 0,
  description: 'A guided tour',
  cancellationDeadline: '2099-01-01T00:00:00.000Z',
  maybeDeadline: null,
  notificationOffsets: [3, 1],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sessions: [mockSession],
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
      linkedProviderIds: [],
      linkProvider: vi.fn(),
      setBuddyProfile: vi.fn(),
    })
  })

  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), linkedProviderIds: [], linkProvider: vi.fn(), setBuddyProfile: vi.fn() })
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

  it('renders seat counts section', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('confirmed')).toBeInTheDocument())
  })

  it('renders pool-scoped confirmed as myCapacity minus myRemaining', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, sessions: [{ ...mockSession, myCapacity: 7, myRemaining: 3 }] })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('confirmed')).toBeInTheDocument())
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders maybe, waitlist, declined from seatCounts', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, sessions: [{ ...mockSession, seatCounts: { confirmed: 0, maybe: 6, waitlist: 8, declined: 9 } }] })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('maybe')).toBeInTheDocument())
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('renders myCapacity in info section when set', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('capacity: 7')).toBeInTheDocument())
  })

  it('renders total capacity in info section when myCapacity is null', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, sessions: [{ ...mockSession, myCapacity: null }] })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('capacity: 10')).toBeInTheDocument())
  })

  it('renders myRemaining in info section when set', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('remaining: 5')).toBeInTheDocument())
  })

  it('renders remaining fallback in info section when myRemaining is null', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, sessions: [{ ...mockSession, myRemaining: null, remaining: 4 }] })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('remaining: 4')).toBeInTheDocument())
  })

  it('shows noBooking when myBookingStatus is null', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, sessions: [{ ...mockSession, myBookingStatus: null }] })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('noBooking')).toBeInTheDocument())
  })

  it.each([
    ['confirmed', 'confirmed'],
    ['maybe', 'maybe'],
    ['waitlist', 'waitlist'],
    ['declined', 'declined'],
  ] as const)('shows %s booking status label', async (status, labelKey) => {
    mockGetTour.mockResolvedValue({ ...mockTour, sessions: [{ ...mockSession, myBookingStatus: status }] })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.queryAllByText(labelKey).length).toBeGreaterThan(0))
  })

  it('passes tour id from params to getTour', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(mockGetTour).toHaveBeenCalledWith('tour-1'))
  })

  it('shows revert button when booking is declined and myRemaining > 0', async () => {
    const declinedTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: 'declined' as const, myRemaining: 3 }] }
    mockGetTour.mockResolvedValue(declinedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'revert' })).toBeInTheDocument())
  })

  it('hides revert button when myRemaining is 0', async () => {
    const declinedTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: 'declined' as const, myRemaining: 0 }] }
    mockGetTour.mockResolvedValue(declinedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.queryByText('noBooking')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'revert' })).not.toBeInTheDocument()
  })

  it('shows book button when tour is bookable and not booked', async () => {
    const bookableTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: null }] }
    mockGetTour.mockResolvedValue(bookableTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'book' })).toBeInTheDocument())
  })

  it('does not show book button when already booked', async () => {
    const bookedTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: 'confirmed' as const }] }
    mockGetTour.mockResolvedValue(bookedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'book' })).not.toBeInTheDocument())
  })

  it('calls createBooking and refreshes tour on book', async () => {
    const bookableTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: null }] }
    const bookedTour = { ...bookableTour, sessions: [{ ...mockSession, myBookingStatus: 'confirmed' as const }] }
    mockGetTour.mockResolvedValueOnce(bookableTour).mockResolvedValueOnce(bookedTour)
    mockCreateBooking.mockResolvedValueOnce({ id: 'bk1', tourId: 'tour-1', sessionId: 'session-1', buddyTier: 'junior', status: 'confirmed', bookedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })

    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'book' })).toBeInTheDocument())
    screen.getByRole('button', { name: 'book' }).click()
    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledWith('tour-1', 'session-1'))
  })

  it('shows cancel button when booking is confirmed', async () => {
    const confirmedTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: 'confirmed' as const }] }
    mockGetTour.mockResolvedValue(confirmedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'cancelBooking' })).toBeInTheDocument())
  })

  it('shows setMaybe button when booking is confirmed', async () => {
    const confirmedTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: 'confirmed' as const }] }
    mockGetTour.mockResolvedValue(confirmedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'setMaybe' })).toBeInTheDocument())
  })

  it('shows cancellation reason form when cancel button is clicked (confirmed)', async () => {
    const confirmedTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: 'confirmed' as const }] }
    mockGetTour.mockResolvedValue(confirmedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'cancelBooking' })).toBeInTheDocument())
    screen.getByRole('button', { name: 'cancelBooking' }).click()
    await waitFor(() => expect(screen.getByText('cancelReasonTitle')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'cancelReasonSubmit' })).toBeInTheDocument()
  })

  it('calls updateBooking with reason on cancel (confirmed → declined)', async () => {
    const confirmedTour = { ...mockTour, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', sessions: [{ ...mockSession, myBookingStatus: 'confirmed' as const }] }
    const cancelledTour = { ...confirmedTour, sessions: [{ ...mockSession, myBookingStatus: 'declined' as const }] }
    mockGetTour.mockResolvedValueOnce(confirmedTour).mockResolvedValueOnce(cancelledTour)
    mockUpdateBooking.mockResolvedValueOnce({ id: 'b1', tourId: 'tour-1', sessionId: 'session-1', buddyTier: 'junior', status: 'declined', bookedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })

    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'cancelBooking' })).toBeInTheDocument())
    screen.getByRole('button', { name: 'cancelBooking' }).click()

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'health' } })
    screen.getByRole('button', { name: 'cancelReasonSubmit' }).click()

    await waitFor(() =>
      expect(mockUpdateBooking).toHaveBeenCalledWith(
        'tour-1',
        'session-1',
        'declined',
        expect.objectContaining({ category: 'health' }),
      )
    )
  })
})
