import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import BuddyHomePage from './page'

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

vi.mock('@/hooks/use-my-bookings', () => ({
  useMyBookings: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { markOnboardingSeen: vi.fn(), getTour: vi.fn(), listMyReflections: vi.fn(), createBooking: vi.fn() },
}))

import { useAuth } from '../../../lib/auth'
import { apiClient } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { fetchUpcomingTours } from './buddy.tour'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { BookingStatusSchema, GroupTypeSchema, TourStatusSchema } from '@peace-buddy/types'
import type {
  BookingStatus,
  MyTourBookingEntry,
  TourDetailResponse,
  TourReflectionResponse,
  TourResponse,
} from '@peace-buddy/types'

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

const reloadBookings = vi.fn()

function mockBookings(bookings: MyTourBookingEntry[] | null) {
  vi.mocked(useMyBookings).mockReturnValue({ bookings, error: false, reload: reloadBookings })
}

function mockTours(tours: TourResponse[]) {
  vi.mocked(fetchUpcomingTours).mockResolvedValueOnce({ ok: true, data: tours })
}

function makeTour(
  id: string,
  overrides: Partial<TourResponse> = {},
  statuses: Array<BookingStatus | null> = [null],
): TourResponse {
  return {
    id,
    groupId: 'group-1',
    group: { id: 'group-1', name: `School ${id}`, type: GroupTypeSchema.enum.school },
    status: TourStatusSchema.enum.published,
    tourDate: '2099-05-01T00:00:00.000Z',
    bookingOpen: true,
    places: [{ id: 'place-1', nameJa: 'Tokyo Station', nameEn: 'Tokyo Station' }],
    participantCount: 0,
    description: null,
    cancellationDeadline: '2099-04-25T00:00:00.000Z',
    maybeDeadline: null,
    notificationOffsets: [],
    sessions: statuses.map((myBookingStatus, i) => ({
      id: `${id}-session-${i}`,
      order: i + 1,
      label: null,
      meetingTime: '1970-01-01T09:00:00.000Z',
      startTime: null,
      endTime: null,
      capacity: 10,
      minBuddies: null,
      participantCount: 0,
      belowMinimum: false,
      confirmedCount: 0,
      myBookingStatus,
      place: { id: 'place-1', nameJa: 'Tokyo Station', nameEn: 'Tokyo Station' },
    })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTourDetail(id: string, overrides: Partial<TourDetailResponse> = {}): TourDetailResponse {
  const tour = makeTour(id, {}, [BookingStatusSchema.enum.confirmed])
  return {
    ...tour,
    sessions: tour.sessions.map((s) => ({
      ...s,
      place: { ...s.place, spots: [] },
      seatCounts: { confirmed: 4, maybe: 0, waitlist: 0, declined: 0 },
      remaining: 6,
      myCapacity: null,
      myRemaining: null,
    })),
    staffInCharge: { name: 'Staff A' },
    ...overrides,
  }
}

function makeEntry(
  tourId: string,
  bookingStatus: BookingStatus,
  overrides: Partial<MyTourBookingEntry> = {},
): MyTourBookingEntry {
  return {
    tourId,
    tourDate: '2099-06-01T00:00:00.000Z',
    places: [{ id: 'place-1', nameJa: 'Nagasaki', nameEn: 'Nagasaki' }],
    status: TourStatusSchema.enum.published,
    maybeDeadline: null,
    reflectionSubmitted: false,
    absent: false,
    group: { name: `Group ${tourId}`, type: 'school' },
    bookings: [
      {
        bookingId: `b-${tourId}`,
        sessionId: `s-${tourId}`,
        sessionOrder: 1,
        sessionLabel: null,
        meetingTime: '1970-01-01T09:00:00.000Z',
        startTime: null,
        endTime: null,
        place: { id: 'place-1', nameJa: '長崎', nameEn: 'Nagasaki' },
        bookingStatus,
        bookedAt: '2099-01-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

describe('BuddyHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBookings([])
    vi.mocked(apiClient.listMyReflections).mockResolvedValue([])
    // A tour-day detail that never arrives leaves the upcoming list in place.
    vi.mocked(apiClient.getTour).mockReturnValue(new Promise(() => {}))
  })

  it('sends an approved buddy who has not been to their profile yet', async () => {
    vi.mocked(apiClient.markOnboardingSeen).mockResolvedValue({ onboardingSeenAt: 'now' } as never)
    mockStatus('trainee', null)

    render(<BuddyHomePage />)

    expect(replace).toHaveBeenCalledWith(routes.buddyProfileOnboarding('en'))
    await vi.waitFor(() => expect(apiClient.markOnboardingSeen).toHaveBeenCalled())
    expect(setBuddyProfile).toHaveBeenCalled()
  })

  it('sends an active buddy who has not been to their profile yet', () => {
    vi.mocked(apiClient.markOnboardingSeen).mockResolvedValue({} as never)
    mockStatus('active', null)

    render(<BuddyHomePage />)

    expect(replace).toHaveBeenCalledWith(routes.buddyProfileOnboarding('en'))
  })

  it('leaves a buddy on the home screen once the visit is stamped', () => {
    mockStatus('active')

    render(<BuddyHomePage />)

    expect(replace).not.toHaveBeenCalled()
    expect(apiClient.markOnboardingSeen).not.toHaveBeenCalled()
  })

  it('sends a pending buddy to the pending page, not to onboarding', () => {
    mockStatus('pending', null)

    render(<BuddyHomePage />)

    expect(replace).toHaveBeenCalledWith(routes.pending('en'))
    expect(apiClient.markOnboardingSeen).not.toHaveBeenCalled()
  })

  it('tells a trainee they are in training, in place of the whole screen', () => {
    mockStatus('trainee')
    render(<BuddyHomePage />)
    expect(screen.getByText('traineeMessage')).toBeInTheDocument()
    expect(screen.queryByText('notRegistered')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('heading')).toHaveLength(0)
  })

  it('tells a rejected buddy they are not registered, in place of the whole screen', () => {
    mockStatus('rejected')
    render(<BuddyHomePage />)
    expect(screen.getByText('notRegistered')).toBeInTheDocument()
    expect(screen.queryAllByRole('heading')).toHaveLength(0)
  })

  it('puts the tours to book before the buddy\'s own upcoming tours, and the links last', async () => {
    mockBookings([makeEntry('next', BookingStatusSchema.enum.confirmed)])
    mockTours([makeTour('open')])
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(await screen.findByText('School open')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'title',
      'upcoming.title',
      'links.title',
    ])
  })

  it('shows a buddy who has never toured the tours to book, with no record', async () => {
    mockTours([makeTour('open')])
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(await screen.findByText('School open')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'record.title' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'actions.title' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'upcoming.title' })).not.toBeInTheDocument()
  })

  it('leads a buddy who has toured with the note for the next tour, before the tours to book', async () => {
    const past = makeEntry('past', BookingStatusSchema.enum.confirmed, {
      status: TourStatusSchema.enum.completed,
      tourDate: '2020-01-01T00:00:00.000Z',
      reflectionSubmitted: true,
    })
    mockBookings([past])
    vi.mocked(apiClient.listMyReflections).mockResolvedValue([
      { tourId: 'past', sessionOrder: 1, couldImprove: 'Slow down at the dome', moments: [] } as unknown as TourReflectionResponse,
    ])
    mockTours([makeTour('open')])
    mockStatus('active')
    render(<BuddyHomePage />)
    const record = await screen.findByRole('region', { name: 'record.title' })
    expect(within(record).getByText('Slow down at the dome')).toBeInTheDocument()
    expect(within(record).getByText('record.milestone')).toBeInTheDocument()
    expect(within(record).getByRole('link', { name: 'record.link' })).toHaveAttribute('href', routes.buddyRecord('en'))
    await screen.findByText('School open')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent).slice(0, 2)).toEqual([
      'record.title',
      'title',
    ])
  })

  it('leaves out the record, not the page, when reflections fail to load', async () => {
    mockBookings([
      makeEntry('past', BookingStatusSchema.enum.confirmed, {
        status: TourStatusSchema.enum.completed,
        tourDate: '2020-01-01T00:00:00.000Z',
      }),
    ])
    vi.mocked(apiClient.listMyReflections).mockRejectedValue(new Error('network'))
    mockTours([makeTour('open')])
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(await screen.findByText('School open')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'record.title' })).not.toBeInTheDocument()
  })

  it('lists every upcoming confirmed tour, nearest first', () => {
    mockBookings([
      makeEntry('later', BookingStatusSchema.enum.confirmed, { tourDate: '2099-07-01T00:00:00.000Z' }),
      makeEntry('sooner', BookingStatusSchema.enum.confirmed),
    ])
    mockStatus('active')
    render(<BuddyHomePage />)
    const upcoming = screen.getByRole('region', { name: 'upcoming.title' })
    expect(within(upcoming).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      routes.buddyTour('en', 'sooner'),
      routes.buddyTour('en', 'later'),
    ])
  })

  it('judges today by the date in Japan, not the UTC date', () => {
    // 01:00 on 15 September in Japan, still 14 September in UTC.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-14T16:00:00.000Z'))
    try {
      mockBookings([
        makeEntry('yesterday', BookingStatusSchema.enum.confirmed, { tourDate: '2026-09-14T00:00:00.000Z' }),
        makeEntry('today', BookingStatusSchema.enum.confirmed, { tourDate: '2026-09-15T00:00:00.000Z' }),
      ])
      mockStatus('active')
      render(<BuddyHomePage />)
      const upcoming = screen.getByRole('region', { name: 'upcoming.title' })
      expect(within(upcoming).getByRole('link')).toHaveAttribute('href', routes.buddyTour('en', 'today'))
      expect(fetchUpcomingTours).toHaveBeenCalledWith('2026-09-15')
    } finally {
      vi.useRealTimers()
    }
  })

  it('lists a Maybe booking under needs your action, linked to its tour', () => {
    mockBookings([makeEntry('m', BookingStatusSchema.enum.maybe, { maybeDeadline: '2099-05-20T00:00:00.000Z' })])
    mockStatus('active')
    render(<BuddyHomePage />)
    const actions = screen.getByRole('region', { name: 'actions.title' })
    expect(within(actions).getByRole('link', { name: /^actions\.maybeBy/ })).toHaveAttribute(
      'href',
      routes.buddyTour('en', 'm'),
    )
  })

  it('links a missing reflection straight to the tour reflection page', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-15T01:00:00.000Z'))
    try {
      mockBookings([
        makeEntry('done', BookingStatusSchema.enum.confirmed, {
          status: TourStatusSchema.enum.completed,
          tourDate: '2026-09-10T00:00:00.000Z',
        }),
      ])
      mockStatus('active')
      render(<BuddyHomePage />)
      const actions = screen.getByRole('region', { name: 'actions.title' })
      expect(within(actions).getByRole('link', { name: /^actions\.reflection/ })).toHaveAttribute(
        'href',
        routes.buddyTourReflection('en', 'done'),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('takes no room for upcoming tours or actions when there are none', () => {
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(screen.queryByRole('region', { name: 'upcoming.title' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'actions.title' })).not.toBeInTheDocument()
  })

  it('shows neither booking section before bookings have loaded', () => {
    mockBookings(null)
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(screen.queryByRole('region', { name: 'upcoming.title' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'actions.title' })).not.toBeInTheDocument()
  })

  it('says bookings could not load, rather than hiding the booking sections', () => {
    vi.mocked(useMyBookings).mockReturnValue({ bookings: null, error: true, reload: reloadBookings })
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(screen.getByRole('alert')).toHaveTextContent('bookingsLoadError')
    expect(screen.queryByRole('region', { name: 'upcoming.title' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'actions.title' })).not.toBeInTheDocument()
  })

  it('says tours could not load, rather than that none are open', async () => {
    vi.mocked(fetchUpcomingTours).mockResolvedValueOnce({ ok: false, error: { code: 'unknown' } } as never)
    mockStatus('active')
    render(<BuddyHomePage />)
    const open = screen.getByRole('region', { name: 'title' })
    expect(await within(open).findByRole('alert')).toHaveTextContent('loadError')
    expect(within(open).queryByText('noTours')).not.toBeInTheDocument()
  })

  it('shows no empty state for open tours while they are loading', () => {
    vi.mocked(fetchUpcomingTours).mockReturnValueOnce(new Promise(() => {}))
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(screen.queryByText('noTours')).not.toBeInTheDocument()
  })

  it('fetches nothing for an active buddy about to be sent to their profile', () => {
    vi.mocked(apiClient.markOnboardingSeen).mockResolvedValue({} as never)
    mockStatus('active', null)
    render(<BuddyHomePage />)
    expect(useMyBookings).not.toHaveBeenCalledWith(true)
    expect(fetchUpcomingTours).not.toHaveBeenCalled()
  })

  it('gives the next tour only the meeting times of its confirmed sessions', () => {
    const entry = makeEntry('mixed', BookingStatusSchema.enum.confirmed)
    const maybeSession = {
      ...entry.bookings[0],
      bookingId: 'b-maybe',
      sessionId: 's-maybe',
      sessionOrder: 2,
      meetingTime: '1970-01-01T13:00:00.000Z',
      bookingStatus: BookingStatusSchema.enum.maybe,
    }
    mockBookings([{ ...entry, bookings: [entry.bookings[0], maybeSession] }])
    mockStatus('active')
    render(<BuddyHomePage />)
    const link = within(screen.getByRole('region', { name: 'upcoming.title' })).getByRole('link')
    expect(link).toHaveTextContent('09:00')
    expect(link).not.toHaveTextContent('13:00')
  })

  it('lists only tours that can be booked', async () => {
    mockTours([makeTour('open'), makeTour('closed', { bookingOpen: false })])
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(await screen.findByText('School open')).toBeInTheDocument()
    expect(screen.queryByText('School closed')).not.toBeInTheDocument()
  })

  it('says so when no tour can be booked', async () => {
    mockTours([makeTour('closed', { bookingOpen: false })])
    mockStatus('active')
    render(<BuddyHomePage />)
    await vi.waitFor(() => expect(fetchUpcomingTours).toHaveBeenCalled())
    expect(await screen.findByText('noTours')).toBeInTheDocument()
  })

  it('shows the nearest three open tours and expands to all of them', async () => {
    mockTours(['a', 'b', 'c', 'd', 'e'].map((id) => makeTour(id)))
    mockStatus('active')
    render(<BuddyHomePage />)
    const open = screen.getByRole('region', { name: 'title' })
    expect(await within(open).findAllByRole('link')).toHaveLength(3)

    fireEvent.click(within(open).getByRole('button', { name: 'open.showAll' }))

    expect(within(open).getAllByRole('link')).toHaveLength(5)
    expect(within(open).getByRole('button', { name: 'open.showFewer' })).toBeInTheDocument()
  })

  it('offers no show-all when every open tour already fits', async () => {
    mockTours(['a', 'b', 'c'].map((id) => makeTour(id)))
    mockStatus('active')
    render(<BuddyHomePage />)
    const open = screen.getByRole('region', { name: 'title' })
    expect(await within(open).findAllByRole('link')).toHaveLength(3)
    expect(within(open).queryByRole('button', { name: 'open.showAll' })).not.toBeInTheDocument()
  })

  it("shows the buddy's own booking status on each session they are booked on", async () => {
    mockTours([
      makeTour('t1', {}, [
        BookingStatusSchema.enum.confirmed,
        BookingStatusSchema.enum.maybe,
        BookingStatusSchema.enum.waitlist,
      ]),
    ])
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(await screen.findByText(BookingStatusSchema.enum.confirmed)).toBeInTheDocument()
    expect(screen.getByText(BookingStatusSchema.enum.maybe)).toBeInTheDocument()
    expect(screen.getByText(BookingStatusSchema.enum.waitlist)).toBeInTheDocument()
  })

  it('shows no booking status for a session not booked or declined', async () => {
    mockTours([makeTour('t1', {}, [null, BookingStatusSchema.enum.declined])])
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(await screen.findByText('School t1')).toBeInTheDocument()
    for (const status of BookingStatusSchema.options) {
      expect(screen.queryByText(status)).not.toBeInTheDocument()
    }
  })

  it('shows no tour status badge, since every tour listed here is published', async () => {
    mockTours([makeTour('t1', {}, [BookingStatusSchema.enum.confirmed])])
    mockStatus('active')
    render(<BuddyHomePage />)
    expect(await screen.findByText(BookingStatusSchema.enum.confirmed)).toBeInTheDocument()
    expect(screen.queryByText(TourStatusSchema.enum.published)).not.toBeInTheDocument()
  })

  describe('on the day of a tour', () => {
    // 10:00 on 15 September in Japan.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-09-15T01:00:00.000Z'))
    })
    afterEach(() => vi.useRealTimers())

    it('leads with the tour-day panel when a confirmed tour is today', async () => {
      mockBookings([makeEntry('today', BookingStatusSchema.enum.confirmed, { tourDate: '2026-09-15T00:00:00.000Z' })])
      vi.mocked(apiClient.getTour).mockResolvedValue(
        makeTourDetail('today', { description: 'Brief for buddies', tourDate: '2026-09-15T00:00:00.000Z' }),
      )
      mockStatus('active')
      render(<BuddyHomePage />)

      const panel = await screen.findByRole('region', { name: 'tourDay.title' })
      expect(apiClient.getTour).toHaveBeenCalledWith('today')
      expect(screen.queryByRole('region', { name: 'upcoming.title' })).not.toBeInTheDocument()
      expect(within(panel).getByText('Brief for buddies')).toBeInTheDocument()
      expect(within(panel).getByText('tourDay.staffInCharge')).toBeInTheDocument()
      expect(within(panel).getByText('tourDay.otherBuddies')).toBeInTheDocument()
      expect(within(panel).getByRole('link', { name: 'tourDay.details' })).toHaveAttribute(
        'href',
        routes.buddyTour('en', 'today'),
      )
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'tourDay.title',
        'title',
        'links.title',
      ])
    })

    it('shows no panel when the confirmed tour is tomorrow', () => {
      mockBookings([makeEntry('tomorrow', BookingStatusSchema.enum.confirmed, { tourDate: '2026-09-16T00:00:00.000Z' })])
      mockStatus('active')
      render(<BuddyHomePage />)
      expect(screen.getByRole('region', { name: 'upcoming.title' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'tourDay.title' })).not.toBeInTheDocument()
      expect(apiClient.getTour).not.toHaveBeenCalled()
    })

    it('shows no panel with no booking', () => {
      mockStatus('active')
      render(<BuddyHomePage />)
      expect(screen.queryByRole('region', { name: 'tourDay.title' })).not.toBeInTheDocument()
      expect(apiClient.getTour).not.toHaveBeenCalled()
    })

    it('shows no panel for a Maybe-only booking today', () => {
      mockBookings([makeEntry('maybe', BookingStatusSchema.enum.maybe, { tourDate: '2026-09-15T00:00:00.000Z' })])
      mockStatus('active')
      render(<BuddyHomePage />)
      expect(screen.queryByRole('region', { name: 'tourDay.title' })).not.toBeInTheDocument()
      expect(apiClient.getTour).not.toHaveBeenCalled()
    })

    it('lists today\'s tour with the upcoming ones when the tour detail fails to load', async () => {
      mockBookings([makeEntry('today', BookingStatusSchema.enum.confirmed, { tourDate: '2026-09-15T00:00:00.000Z' })])
      vi.mocked(apiClient.getTour).mockRejectedValue(new Error('network'))
      mockStatus('active')
      render(<BuddyHomePage />)
      expect(apiClient.getTour).toHaveBeenCalledWith('today')
      // Let the rejection settle before asserting, or this checks the loading state.
      await act(async () => {})
      expect(screen.getByRole('region', { name: 'upcoming.title' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'tourDay.title' })).not.toBeInTheDocument()
    })
  })
})
