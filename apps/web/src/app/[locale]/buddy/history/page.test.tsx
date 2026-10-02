import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

vi.mock('./_components/working-hours', () => ({ WorkingHours: () => null }))

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
  places: [{ id: 'place-1', nameJa: 'Tokyo Station', nameEn: 'Tokyo Station' }],
  status: 'published',
  maybeDeadline: null,
  reflectionSubmitted: false,
  absent: false,
  group: { name: 'Test School', type: 'school' },
  bookings: [{
    bookingId: 'b1',
    sessionId: 's1',
    sessionOrder: 1,
    sessionLabel: null,
    meetingTime: '1970-01-01T09:00:00.000Z',
    startTime: null,
    endTime: null,
    place: { id: 'place-1', nameJa: '長崎', nameEn: 'Nagasaki' },
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
      linkedProviderIds: [],
      linkProvider: vi.fn(),
      setBuddyProfile: vi.fn(),
    })
  })

  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), linkedProviderIds: [], linkProvider: vi.fn(), setBuddyProfile: vi.fn() })
    mockUseMyBookings.mockReturnValue({ bookings: null, error: false, reload: vi.fn() })
    const { container } = render(<BuddyHistoryPage />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while bookings are null', () => {
    mockUseMyBookings.mockReturnValue({ bookings: null, error: false, reload: vi.fn() })
    const { container } = render(<BuddyHistoryPage />)
    expect(container.firstChild).toBeNull()
  })

  it('says so when the buddy has no past tour', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [], error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('noPast')).toBeInTheDocument())
  })

  it('lists past tours only; upcoming ones are on Home', async () => {
    const future = makeEntry({ tourId: 'future', tourDate: '2099-06-01T00:00:00.000Z' })
    const past = makeEntry({ tourId: 'past', tourDate: '2020-01-01T00:00:00.000Z', group: { name: 'Past School', type: 'school' } })
    mockUseMyBookings.mockReturnValue({ bookings: [future, past], error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('Past School')).toBeInTheDocument())
    expect(screen.queryByText('Test School')).not.toBeInTheDocument()
  })

  it('treats a tour held today in Japan as not yet past', async () => {
    // 01:00 on 15 September in Japan, still 14 September in UTC.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'))
    try {
      mockUseMyBookings.mockReturnValue({ bookings: [makeEntry({ tourDate: '2026-09-15T00:00:00.000Z' })], error: false, reload: vi.fn() })
      render(<BuddyHistoryPage />)
      await waitFor(() => expect(screen.getByText('noPast')).toBeInTheDocument())
      expect(screen.queryByText('Test School')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('hides a past tour the buddy did not attend', async () => {
    const cancelled = makeEntry({ tourId: 't1', tourDate: '2020-01-01T00:00:00.000Z', status: 'cancelled' })
    const notConfirmed = makeEntry({
      tourId: 't2',
      tourDate: '2020-02-01T00:00:00.000Z',
      bookings: [{ ...makeEntry().bookings[0], bookingStatus: 'waitlist' }],
    })
    mockUseMyBookings.mockReturnValue({ bookings: [cancelled, notConfirmed], error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('noPast')).toBeInTheDocument())
    expect(screen.queryByText('Test School')).not.toBeInTheDocument()
    expect(screen.queryByText('summary')).not.toBeInTheDocument()
  })

  it('shows a summary line and a header per year for past tours', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeEntry({ tourId: 't1', tourDate: '2021-05-01T00:00:00.000Z' }),
        makeEntry({ tourId: 't2', tourDate: '2021-03-01T00:00:00.000Z' }),
        makeEntry({ tourId: 't3', tourDate: '2020-01-01T00:00:00.000Z' }),
      ],
      error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('summary')).toBeInTheDocument())
    expect(screen.getAllByRole('heading', { level: 3, name: 'year' })).toHaveLength(2)
  })

  it('isolates past tours without a reflection in one action', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeEntry({ tourId: 't1', tourDate: '2020-01-01T00:00:00.000Z', group: { name: 'Evaluated', type: 'school' }, reflectionSubmitted: true }),
        makeEntry({ tourId: 't2', tourDate: '2020-02-01T00:00:00.000Z', group: { name: 'Not evaluated', type: 'school' } }),
      ],
      error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    const toggle = await screen.findByRole('button', { name: 'filterUnreflected' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Evaluated')).not.toBeInTheDocument()
    expect(screen.getByText('Not evaluated')).toBeInTheDocument()
  })

  it('offers no reflection filter when every past tour has one', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [makeEntry({ tourDate: '2020-01-01T00:00:00.000Z', reflectionSubmitted: true })],
      error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'filterUnreflected' })).not.toBeInTheDocument()
  })

  it('filters past tours by group name', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeEntry({ tourId: 't1', tourDate: '2020-01-01T00:00:00.000Z', group: { name: 'Sakura School', type: 'school' } }),
        makeEntry({ tourId: 't2', tourDate: '2020-02-01T00:00:00.000Z', group: { name: 'Minato Co.', type: 'company' } }),
      ],
      error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    const input = await screen.findByRole('combobox', { name: 'searchGroup' })
    fireEvent.click(input)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Minato Co.', 'Sakura School'])
    fireEvent.change(input, { target: { value: 'minato' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('Sakura School')).not.toBeInTheDocument()
    expect(screen.getByText('Minato Co.')).toBeInTheDocument()
  })

  it('says so when the filters match no past tour', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeEntry({ tourId: 't1', tourDate: '2020-01-01T00:00:00.000Z', group: { name: 'Sakura School', type: 'school' }, reflectionSubmitted: true }),
        makeEntry({ tourId: 't2', tourDate: '2020-02-01T00:00:00.000Z', group: { name: 'Minato Co.', type: 'company' } }),
      ],
      error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    fireEvent.change(await screen.findByRole('combobox', { name: 'searchGroup' }), { target: { value: 'sakura' } })
    fireEvent.click(screen.getByRole('button', { name: 'filterUnreflected' }))
    expect(screen.getByText('noMatches')).toBeInTheDocument()
  })

  it('renders tour date and location', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [makeEntry({ tourDate: '2020-06-01T00:00:00.000Z' })], error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
    expect(screen.getByText(/2020\/06\/01/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo Station/)).toBeInTheDocument()
  })

  it('renders view link pointing to tour detail', async () => {
    mockUseMyBookings.mockReturnValue({ bookings: [makeEntry({ tourDate: '2020-06-01T00:00:00.000Z' })], error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'viewTour' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'viewTour' })).toHaveAttribute('href', '/en/buddy/tours/t1')
  })

  it('passes ready=true when auth is loaded and user exists', () => {
    mockUseMyBookings.mockReturnValue({ bookings: [], error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    expect(mockUseMyBookings).toHaveBeenCalledWith(true)
  })

  it('passes ready=false when loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), linkedProviderIds: [], linkProvider: vi.fn(), setBuddyProfile: vi.fn() })
    mockUseMyBookings.mockReturnValue({ bookings: null, error: false, reload: vi.fn() })
    render(<BuddyHistoryPage />)
    expect(mockUseMyBookings).toHaveBeenCalledWith(false)
  })
})
