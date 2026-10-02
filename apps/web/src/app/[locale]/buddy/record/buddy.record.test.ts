import { describe, it, expect } from 'vitest'
import type { MySessionBookingEntry, MyTourBookingEntry, TourReflectionResponse } from '@peace-buddy/types'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'
import { buildRecord, nextTourMilestone } from './buddy.record'

const TODAY = '2026-09-27'
const HIROSHIMA = { id: 'hiroshima', nameJa: '広島', nameEn: 'Hiroshima' }
const NAGASAKI = { id: 'nagasaki', nameJa: '長崎', nameEn: 'Nagasaki' }

function session(overrides: Partial<MySessionBookingEntry> = {}): MySessionBookingEntry {
  return {
    bookingId: 'b',
    sessionId: 's',
    sessionOrder: 1,
    sessionLabel: null,
    meetingTime: '1970-01-01T09:00:00.000Z',
    startTime: '1970-01-01T09:30:00.000Z',
    endTime: '1970-01-01T12:00:00.000Z',
    place: HIROSHIMA,
    bookingStatus: BookingStatusSchema.enum.confirmed,
    bookedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function tour(tourId: string, tourDate: string, overrides: Partial<MyTourBookingEntry> = {}): MyTourBookingEntry {
  return {
    tourId,
    tourDate: `${tourDate}T00:00:00.000Z`,
    places: [HIROSHIMA],
    status: TourStatusSchema.enum.completed,
    maybeDeadline: null,
    reflectionSubmitted: true,
    absent: false,
    group: { name: `Group ${tourId}`, type: 'school' },
    bookings: [session({ sessionId: `s-${tourId}` })],
    ...overrides,
  }
}

function reflection(tourId: string, overrides: Partial<TourReflectionResponse> = {}): TourReflectionResponse {
  return {
    id: `r-${tourId}`,
    buddyId: 'buddy-1',
    sessionId: `s-${tourId}`,
    sessionOrder: 1,
    sessionLabel: null,
    tourId,
    didWell: null,
    couldImprove: null,
    notesForOthers: null,
    openQuestions: null,
    moments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    locked: true,
    ...overrides,
  }
}

const moment = (id: string) => ({ id, position: 0, spotId: null, placeNote: 'x', description: `moment ${id}`, spot: null })
const group = (name: string) => ({ group: { name, type: 'school' as const } })

describe('buildRecord', () => {
  it('returns null when the buddy has attended no tour', () => {
    expect(buildRecord([tour('future', '2026-10-01')], [], TODAY)).toBeNull()
  })

  it('counts attended past tours and distinct groups', () => {
    const record = buildRecord(
      [
        tour('a', '2026-09-01'),
        tour('b', '2026-05-01', group('Group a')),
        tour('c', '2025-01-10'),
        tour('cancelled', '2026-04-01', { status: TourStatusSchema.enum.cancelled }),
        tour('upcoming', '2026-10-01'),
      ],
      [],
      TODAY,
    )
    expect(record).toMatchObject({ tours: 3, groups: 2 })
  })

  it('sums start-to-end time of confirmed sessions and counts sessions without times apart', () => {
    const record = buildRecord(
      [
        tour('a', '2026-09-01', {
          bookings: [
            session({ sessionId: 's1' }),
            session({ sessionId: 's2', startTime: null }),
            session({ sessionId: 's3', bookingStatus: BookingStatusSchema.enum.waitlist }),
          ],
        }),
      ],
      [],
      TODAY,
    )
    expect(record?.minutesOnTour).toBe(150)
    expect(record?.sessionsWithoutTimes).toBe(1)
  })

  it("counts tours per place of the buddy's own sessions and per group name, largest first", () => {
    const record = buildRecord(
      [
        tour('a', '2026-09-01', {
          ...group('Sakura'),
          places: [HIROSHIMA, NAGASAKI],
          bookings: [
            session({ sessionId: 's1' }),
            session({ sessionId: 's2', place: NAGASAKI, bookingStatus: BookingStatusSchema.enum.waitlist }),
          ],
        }),
        tour('b', '2026-08-01', { ...group('Sakura'), bookings: [session({ place: NAGASAKI })] }),
        tour('c', '2026-07-01', { ...group('Acme'), bookings: [session({ place: NAGASAKI })] }),
      ],
      [],
      TODAY,
    )
    expect(record?.places).toEqual([
      { place: NAGASAKI, tours: 2 },
      { place: HIROSHIMA, tours: 1 },
    ])
    expect(record?.perGroup).toEqual([
      { name: 'Sakura', tours: 2 },
      { name: 'Acme', tours: 1 },
    ])
  })

  it('describes the last tour: which visit to its group and places, and what the buddy did well', () => {
    const record = buildRecord(
      [
        tour('last', '2026-09-20', { ...group('Sakura'), bookings: [session({ place: NAGASAKI })] }),
        tour('before', '2026-05-01', { ...group('Sakura'), bookings: [session({ place: NAGASAKI })] }),
        tour('first', '2026-01-01', group('Acme')),
      ],
      [reflection('last', { didWell: '  Kept every question going  ' })],
      TODAY,
    )
    expect(record?.lastTour).toMatchObject({
      groupVisit: 2,
      placeVisits: [{ place: NAGASAKI, tours: 2 }],
      didWell: 'Kept every question going',
      canReflect: false,
    })
    expect(record?.lastTour.entry.tourId).toBe('last')
  })

  it('offers a reflection on the last tour only when it is completed and has none', () => {
    const unreflected = buildRecord([tour('a', '2026-09-01', { reflectionSubmitted: false })], [], TODAY)
    const notCompleted = buildRecord(
      [tour('a', '2026-09-01', { reflectionSubmitted: false, status: TourStatusSchema.enum.published })],
      [],
      TODAY,
    )
    expect(unreflected?.lastTour.canReflect).toBe(true)
    expect(notCompleted?.lastTour.canReflect).toBe(false)
  })

  it('carries the latest "could have done better" forward, skipping blank ones', () => {
    const record = buildRecord(
      [
        tour('next', '2026-10-04', { status: TourStatusSchema.enum.published }),
        tour('later', '2026-11-01', { status: TourStatusSchema.enum.published }),
        tour('waitlisted', '2026-09-30', {
          status: TourStatusSchema.enum.published,
          bookings: [session({ bookingStatus: BookingStatusSchema.enum.waitlist })],
        }),
        tour('last', '2026-09-20'),
        tour('older', '2026-08-01'),
      ],
      [reflection('last', { couldImprove: '   ' }), reflection('older', { couldImprove: 'Pace the second half' })],
      TODAY,
    )
    expect(record?.nextTourNote).toMatchObject({
      couldImprove: 'Pace the second half',
      fromTourDate: '2026-08-01T00:00:00.000Z',
    })
  })

  it('has no note when no reflection says what could have gone better', () => {
    expect(buildRecord([tour('a', '2026-09-01')], [reflection('a')], TODAY)?.nextTourNote).toBeNull()
  })

  it('lists milestones newest first: first tour, 5th and 10th tours, first time at a place, a group again', () => {
    const tours = Array.from({ length: 10 }, (_, i) =>
      tour(`t${i + 1}`, `2026-0${Math.floor(i / 5) + 1}-${10 + (i % 5)}`, {
        ...group(i === 3 ? 'Group t1' : `Group t${i + 1}`),
        bookings: [session({ place: i === 2 ? NAGASAKI : HIROSHIMA })],
      }),
    )
    const record = buildRecord(tours.reverse(), [], TODAY)
    expect(record?.milestones.map((m) => [m.kind, m.tourId])).toEqual([
      ['nthTour', 't10'],
      ['nthTour', 't5'],
      ['groupAgain', 't4'],
      ['firstPlace', 't3'],
      ['firstTour', 't1'],
    ])
  })

  it('lists non-blank open questions and every moment, newest tour first', () => {
    const record = buildRecord(
      [tour('a', '2026-08-01'), tour('b', '2026-09-01'), tour('c', '2026-07-01')],
      [
        reflection('a', { openQuestions: 'When was it built?', moments: [moment('m1')] }),
        reflection('b', { openQuestions: '  Who designed it?  ', moments: [moment('m2'), moment('m3')] }),
        reflection('c', { openQuestions: '   ' }),
      ],
      TODAY,
    )
    expect(record?.openQuestions.map((q) => [q.tourId, q.text])).toEqual([
      ['b', 'Who designed it?'],
      ['a', 'When was it built?'],
    ])
    expect(record?.moments.map((m) => m.moment.id)).toEqual(['m2', 'm3', 'm1'])
  })
})

describe('nextTourMilestone', () => {
  it('counts to the 5th tour, then the 10th, then every 10th', () => {
    expect(nextTourMilestone(0)).toEqual({ count: 5, toGo: 5 })
    expect(nextTourMilestone(4)).toEqual({ count: 5, toGo: 1 })
    expect(nextTourMilestone(5)).toEqual({ count: 10, toGo: 5 })
    expect(nextTourMilestone(10)).toEqual({ count: 20, toGo: 10 })
    expect(nextTourMilestone(27)).toEqual({ count: 30, toGo: 3 })
  })
})
