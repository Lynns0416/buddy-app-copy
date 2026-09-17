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
  maybeDeadline: null,
  selfEvaluationSubmitted: false,
  group: { name: 'Test School', type: 'school' },
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
      linkedProviderIds: [],
      linkProvider: vi.fn(),
      setBuddyProfile: vi.fn(),
    })
  })

  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), linkedProviderIds: [], linkProvider: vi.fn(), setBuddyProfile: vi.fn() })
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

  it('judges upcoming by the date in Japan, not the UTC date', async () => {
    // 01:00 on 15 September in Japan, still 14 September in UTC.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'))
    try {
      mockUseMyBookings.mockReturnValue({ bookings: [makeEntry({ tourDate: '2026-09-14T00:00:00.000Z' })], error: false })
      render(<BuddyHistoryPage />)
      await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
      expect(screen.getByText('noUpcoming')).toBeInTheDocument()
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
    mockUseMyBookings.mockReturnValue({ bookings: [cancelled, notConfirmed], error: false })
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
      error: false,
    })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('summary')).toBeInTheDocument())
    expect(screen.getAllByRole('heading', { level: 3, name: 'year' })).toHaveLength(2)
  })

  it('isolates past tours without a self-evaluation in one action', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeEntry({ tourId: 't1', tourDate: '2020-01-01T00:00:00.000Z', group: { name: 'Evaluated', type: 'school' }, selfEvaluationSubmitted: true }),
        makeEntry({ tourId: 't2', tourDate: '2020-02-01T00:00:00.000Z', group: { name: 'Not evaluated', type: 'school' } }),
      ],
      error: false,
    })
    render(<BuddyHistoryPage />)
    const toggle = await screen.findByRole('button', { name: 'filterUnevaluated' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Evaluated')).not.toBeInTheDocument()
    expect(screen.getByText('Not evaluated')).toBeInTheDocument()
  })

  it('offers no self-evaluation filter when every past tour is evaluated', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [makeEntry({ tourDate: '2020-01-01T00:00:00.000Z', selfEvaluationSubmitted: true })],
      error: false,
    })
    render(<BuddyHistoryPage />)
    await waitFor(() => expect(screen.getByText('Test School')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'filterUnevaluated' })).not.toBeInTheDocument()
  })

  it('filters past tours by group name', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeEntry({ tourId: 't1', tourDate: '2020-01-01T00:00:00.000Z', group: { name: 'Sakura School', type: 'school' } }),
        makeEntry({ tourId: 't2', tourDate: '2020-02-01T00:00:00.000Z', group: { name: 'Minato Co.', type: 'company' } }),
      ],
      error: false,
    })
    const { container } = render(<BuddyHistoryPage />)
    const input = await screen.findByRole('combobox', { name: 'searchGroup' })
    const options = container.querySelectorAll(`datalist#${input.getAttribute('list')} option`)
    expect(Array.from(options, (o) => o.getAttribute('value'))).toEqual(['Minato Co.', 'Sakura School'])
    fireEvent.change(input, { target: { value: 'minato' } })
    expect(screen.queryByText('Sakura School')).not.toBeInTheDocument()
    expect(screen.getByText('Minato Co.')).toBeInTheDocument()
  })

  it('says so when the filters match no past tour', async () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeEntry({ tourId: 't1', tourDate: '2020-01-01T00:00:00.000Z', group: { name: 'Sakura School', type: 'school' }, selfEvaluationSubmitted: true }),
        makeEntry({ tourId: 't2', tourDate: '2020-02-01T00:00:00.000Z', group: { name: 'Minato Co.', type: 'company' } }),
      ],
      error: false,
    })
    render(<BuddyHistoryPage />)
    fireEvent.change(await screen.findByRole('combobox', { name: 'searchGroup' }), { target: { value: 'sakura' } })
    fireEvent.click(screen.getByRole('button', { name: 'filterUnevaluated' }))
    expect(screen.getByText('noMatches')).toBeInTheDocument()
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
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), linkedProviderIds: [], linkProvider: vi.fn(), setBuddyProfile: vi.fn() })
    mockUseMyBookings.mockReturnValue({ bookings: null, error: false })
    render(<BuddyHistoryPage />)
    expect(mockUseMyBookings).toHaveBeenCalledWith(false)
  })
})
