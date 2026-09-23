import { describe, it, expect } from 'vitest'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'
import type { BookingStatus, MyTourBookingEntry } from '@peace-buddy/types'
import { findActionItems, findNextTour, isTourDay, REFLECTION_PROMPT_DAYS } from './buddy.home'

const today = '2026-09-15'

function makeEntry(
  tourId: string,
  bookingStatus: BookingStatus,
  overrides: Partial<MyTourBookingEntry> = {},
): MyTourBookingEntry {
  return {
    tourId,
    tourDate: '2026-10-01T00:00:00.000Z',
    location: 'Nagasaki',
    status: TourStatusSchema.enum.published,
    maybeDeadline: null,
    reflectionSubmitted: false,
    group: { name: `Group ${tourId}`, type: 'school' },
    bookings: [
      {
        bookingId: `b-${tourId}`,
        sessionId: `s-${tourId}`,
        sessionOrder: 1,
        sessionLabel: null,
        meetingTime: '1970-01-01T09:00:00.000Z',
        bookingStatus,
        bookedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

const completed = (tourId: string, tourDate: string, overrides: Partial<MyTourBookingEntry> = {}) =>
  makeEntry(tourId, BookingStatusSchema.enum.confirmed, { status: TourStatusSchema.enum.completed, tourDate, ...overrides })

describe('findNextTour', () => {
  it('picks the nearest upcoming tour with a confirmed booking', () => {
    const later = makeEntry('later', BookingStatusSchema.enum.confirmed, { tourDate: '2026-11-01T00:00:00.000Z' })
    const sooner = makeEntry('sooner', BookingStatusSchema.enum.confirmed)
    expect(findNextTour([later, sooner], today)?.tourId).toBe('sooner')
  })

  it('counts a tour taking place today', () => {
    const entry = makeEntry('today', BookingStatusSchema.enum.confirmed, { tourDate: `${today}T00:00:00.000Z` })
    expect(findNextTour([entry], today)?.tourId).toBe('today')
  })

  it('ignores Maybe and Waitlist bookings, past tours and cancelled tours', () => {
    const bookings = [
      makeEntry('maybe', BookingStatusSchema.enum.maybe),
      makeEntry('waitlist', BookingStatusSchema.enum.waitlist),
      makeEntry('past', BookingStatusSchema.enum.confirmed, { tourDate: '2026-09-01T00:00:00.000Z' }),
      makeEntry('cancelled', BookingStatusSchema.enum.confirmed, { status: TourStatusSchema.enum.cancelled }),
    ]
    expect(findNextTour(bookings, today)).toBeNull()
  })
})

describe('isTourDay', () => {
  const on = (tourDate: string, status: BookingStatus = BookingStatusSchema.enum.confirmed) =>
    findNextTour([makeEntry('t', status, { tourDate })], today)

  it('is true when the next confirmed tour is today', () => {
    expect(isTourDay(on('2026-09-15T00:00:00.000Z'), today)).toBe(true)
  })

  it('is false when the next confirmed tour is tomorrow', () => {
    expect(isTourDay(on('2026-09-16T00:00:00.000Z'), today)).toBe(false)
  })

  it('is false with no booking', () => {
    expect(isTourDay(findNextTour([], today), today)).toBe(false)
  })

  it('is false for a Maybe-only booking today, which is not a commitment', () => {
    expect(isTourDay(on('2026-09-15T00:00:00.000Z', BookingStatusSchema.enum.maybe), today)).toBe(false)
  })
})

describe('a tour with both a confirmed and a Maybe session', () => {
  it('is the next tour and also a Maybe to resolve', () => {
    const base = makeEntry('mixed', BookingStatusSchema.enum.confirmed)
    const maybeSession = {
      ...base.bookings[0],
      bookingId: 'b-maybe',
      sessionId: 's-maybe',
      sessionOrder: 2,
      bookingStatus: BookingStatusSchema.enum.maybe,
    }
    const entry: MyTourBookingEntry = { ...base, bookings: [...base.bookings, maybeSession] }
    expect(findNextTour([entry], today)).toBe(entry)
    expect(findActionItems([entry], today)).toEqual([{ kind: 'maybe', entry, deadlinePassed: false }])
  })
})

describe('findActionItems', () => {
  it('lists an upcoming Maybe booking with whether its deadline has passed', () => {
    const open = makeEntry('open', BookingStatusSchema.enum.maybe, { maybeDeadline: '2026-09-20T00:00:00.000Z' })
    const overdue = makeEntry('overdue', BookingStatusSchema.enum.maybe, {
      tourDate: '2026-10-02T00:00:00.000Z',
      maybeDeadline: '2026-09-10T00:00:00.000Z',
    })
    const noDeadline = makeEntry('none', BookingStatusSchema.enum.maybe, { tourDate: '2026-10-03T00:00:00.000Z' })

    expect(findActionItems([noDeadline, overdue, open], today)).toEqual([
      { kind: 'maybe', entry: open, deadlinePassed: false },
      { kind: 'maybe', entry: overdue, deadlinePassed: true },
      { kind: 'maybe', entry: noDeadline, deadlinePassed: false },
    ])
  })

  it('treats the deadline day itself as passed, as the tour detail page does', () => {
    const entry = makeEntry('m', BookingStatusSchema.enum.maybe, { maybeDeadline: `${today}T00:00:00.000Z` })
    expect(findActionItems([entry], today)).toEqual([{ kind: 'maybe', entry, deadlinePassed: true }])
  })

  it('does not list a Maybe on a tour that has already taken place', () => {
    const entry = makeEntry('m', BookingStatusSchema.enum.maybe, { tourDate: '2026-09-01T00:00:00.000Z' })
    expect(findActionItems([entry], today)).toEqual([])
  })

  it(`asks for a missing reflection on a tour completed in the last ${REFLECTION_PROMPT_DAYS} days`, () => {
    const recent = completed('recent', '2026-08-16T00:00:00.000Z')
    const old = completed('old', '2026-08-15T00:00:00.000Z')
    expect(findActionItems([recent, old], today)).toEqual([{ kind: 'reflection', entry: recent }])
  })

  it('does not ask for a reflection already written, or without a confirmed booking', () => {
    const submitted = completed('submitted', '2026-09-10T00:00:00.000Z', { reflectionSubmitted: true })
    const waitlisted = makeEntry('waitlisted', BookingStatusSchema.enum.waitlist, {
      status: TourStatusSchema.enum.completed,
      tourDate: '2026-09-10T00:00:00.000Z',
    })
    expect(findActionItems([submitted, waitlisted], today)).toEqual([])
  })

  it('lists an upcoming Waitlist booking', () => {
    const entry = makeEntry('w', BookingStatusSchema.enum.waitlist)
    expect(findActionItems([entry], today)).toEqual([{ kind: 'waitlist', entry }])
  })

  it('orders Maybe bookings first, then reflections, then waitlist entries', () => {
    const waitlist = makeEntry('w', BookingStatusSchema.enum.waitlist, { tourDate: '2026-09-16T00:00:00.000Z' })
    const reflection = completed('e', '2026-09-10T00:00:00.000Z')
    const maybe = makeEntry('m', BookingStatusSchema.enum.maybe, { tourDate: '2026-12-01T00:00:00.000Z' })
    expect(findActionItems([waitlist, reflection, maybe], today).map((i) => i.kind)).toEqual([
      'maybe',
      'reflection',
      'waitlist',
    ])
  })
})
