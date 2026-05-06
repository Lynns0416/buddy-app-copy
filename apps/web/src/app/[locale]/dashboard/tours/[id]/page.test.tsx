import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  routes: { dashboard: (locale: string) => `/${locale}/dashboard` },
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
  participantCount: 0,
  description: 'A guided tour',
  cancellationDeadline: '2099-01-01T00:00:00.000Z',
  maybeDeadline: null,
  notificationOffsets: [3, 1],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  seatCounts: { confirmed: 3, maybe: 1, waitlist: 2, declined: 0 },
  remaining: 7,
  myCapacity: 7,
  myRemaining: 5,
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

  it('renders seat counts section with seatCounts title', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('seatCounts')).toBeInTheDocument())
  })

  it('renders pool-scoped confirmed as myCapacity minus myRemaining', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, myCapacity: 7, myRemaining: 3 })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('confirmed')).toBeInTheDocument())
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders maybe, waitlist, declined from seatCounts', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, seatCounts: { confirmed: 0, maybe: 6, waitlist: 8, declined: 9 } })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('maybe')).toBeInTheDocument())
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('renders myCapacity in info section when set', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('capacity')).toBeInTheDocument())
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders total capacity in info section when myCapacity is null', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, myCapacity: null })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('capacity')).toBeInTheDocument())
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders myRemaining in info section when set', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('remaining')).toBeInTheDocument())
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders remaining fallback in info section when myRemaining is null', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, myRemaining: null, remaining: 4 })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('remaining')).toBeInTheDocument())
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows noBooking when myBookingStatus is null', async () => {
    mockGetTour.mockResolvedValue({ ...mockTour, myBookingStatus: null })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('noBooking')).toBeInTheDocument())
  })

  it.each([
    ['confirmed', 'confirmed'],
    ['maybe', 'maybe'],
    ['waitlist', 'waitlist'],
    ['declined', 'declined'],
  ] as const)('shows %s booking status label', async (status, labelKey) => {
    mockGetTour.mockResolvedValue({ ...mockTour, myBookingStatus: status })
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.queryAllByText(labelKey).length).toBeGreaterThan(0))
  })

  it('passes tour id from params to getTour', async () => {
    mockGetTour.mockResolvedValue(mockTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(mockGetTour).toHaveBeenCalledWith('tour-1'))
  })

  it('shows revert button when booking is declined and myRemaining > 0', async () => {
    const declinedTour = { ...mockTour, myBookingStatus: 'declined' as const, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', myRemaining: 3 }
    mockGetTour.mockResolvedValue(declinedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('revert')).toBeInTheDocument())
  })

  it('hides revert button when myRemaining is 0', async () => {
    const declinedTour = { ...mockTour, myBookingStatus: 'declined' as const, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z', myRemaining: 0 }
    mockGetTour.mockResolvedValue(declinedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.queryByText('noBooking')).not.toBeInTheDocument())
    expect(screen.queryByText('revert')).not.toBeInTheDocument()
  })

  it('shows book button when tour is bookable and not booked', async () => {
    const bookableTour = { ...mockTour, myBookingStatus: null, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z' }
    mockGetTour.mockResolvedValue(bookableTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('book')).toBeInTheDocument())
  })

  it('does not show book button when already booked', async () => {
    const bookedTour = { ...mockTour, myBookingStatus: 'confirmed' as const, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z' }
    mockGetTour.mockResolvedValue(bookedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.queryByText('book')).not.toBeInTheDocument())
  })

  it('calls createBooking and refreshes tour on book', async () => {
    const bookableTour = { ...mockTour, myBookingStatus: null, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z' }
    const bookedTour = { ...bookableTour, myBookingStatus: 'confirmed' as const }
    mockGetTour.mockResolvedValueOnce(bookableTour).mockResolvedValueOnce(bookedTour)
    mockCreateBooking.mockResolvedValueOnce({ id: 'bk1', tourId: 'tour-1', buddyTier: 'junior', status: 'confirmed', bookedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })

    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('book')).toBeInTheDocument())
    screen.getByText('book').click()
    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledWith('tour-1'))
  })

  it('shows cancel button when booking is confirmed', async () => {
    const confirmedTour = { ...mockTour, myBookingStatus: 'confirmed' as const, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z' }
    mockGetTour.mockResolvedValue(confirmedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('cancelBooking')).toBeInTheDocument())
  })

  it('shows setMaybe button when booking is confirmed', async () => {
    const confirmedTour = { ...mockTour, myBookingStatus: 'confirmed' as const, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z' }
    mockGetTour.mockResolvedValue(confirmedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('setMaybe')).toBeInTheDocument())
  })

  it('shows cancellation reason form when cancel button is clicked (confirmed)', async () => {
    const confirmedTour = { ...mockTour, myBookingStatus: 'confirmed' as const, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z' }
    mockGetTour.mockResolvedValue(confirmedTour)
    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('cancelBooking')).toBeInTheDocument())
    screen.getByText('cancelBooking').click()
    await waitFor(() => expect(screen.getByText('cancelReasonTitle')).toBeInTheDocument())
    expect(screen.getByText('cancelReasonSubmit')).toBeInTheDocument()
  })

  it('calls updateBooking with reason on cancel (confirmed → declined)', async () => {
    const confirmedTour = { ...mockTour, myBookingStatus: 'confirmed' as const, bookingOpen: true, status: 'published' as const, tourDate: '2099-05-01T00:00:00.000Z' }
    const cancelledTour = { ...confirmedTour, myBookingStatus: 'declined' as const }
    mockGetTour.mockResolvedValueOnce(confirmedTour).mockResolvedValueOnce(cancelledTour)
    mockUpdateBooking.mockResolvedValueOnce({ id: 'b1', tourId: 'tour-1', buddyTier: 'junior', status: 'declined', bookedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })

    render(<TourDetailPage />)
    await waitFor(() => expect(screen.getByText('cancelBooking')).toBeInTheDocument())
    screen.getByText('cancelBooking').click()

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'health' } })
    screen.getByText('cancelReasonSubmit').click()

    await waitFor(() =>
      expect(mockUpdateBooking).toHaveBeenCalledWith(
        'tour-1',
        'declined',
        expect.objectContaining({ category: 'health', unavoidable: false }),
      )
    )
  })
})
