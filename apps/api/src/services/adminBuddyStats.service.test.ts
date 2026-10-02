import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { EVALUATION_SCORE_FIELDS } from '@peace-buddy/types'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  buddyProfile: { findMany: MockFn }
  booking: { findMany: MockFn }
  buddyCancellationDeadlineOverride: { findMany: MockFn }
  adminEvaluation: { findMany: MockFn }
  attendance: { findMany: MockFn }
  adminProfileEvaluation: { findMany: MockFn }
  tourReflection: { findMany: MockFn }
  place: { findMany: MockFn }
}

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    buddyCancellationDeadlineOverride: { findMany: vi.fn() },
    adminEvaluation: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    adminProfileEvaluation: { findMany: vi.fn() },
    tourReflection: { findMany: vi.fn() },
    place: { findMany: vi.fn() },
  },
}))

import { db } from '../lib/db'
import { computeBuddyStats, getBuddyStats, listBuddyStats, type BuddyStatsInput } from './adminBuddyStats.service'

const mdb = db as unknown as MockDb

// The `where` of a query's first call, for matching nested filters.
function whereOf(fn: MockFn): unknown {
  return (fn.mock.calls[0][0] as { where: unknown }).where
}

// 2026-06-20 in JST.
const NOW = new Date('2026-06-20T03:00:00Z')

type Booking = BuddyStatsInput['bookings'][number]
type Evaluation = BuddyStatsInput['evaluations'][number]
type Attendance = BuddyStatsInput['attendances'][number]

function time(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`)
}

function booking(overrides: Partial<Omit<Booking, 'session' | 'tour'>> & {
  session?: Partial<Booking['session']>
  tour?: Partial<Booking['tour']>
} = {}): Booking {
  return {
    buddyId: 'b1',
    tourId: 't1',
    status: 'confirmed',
    cancellationReason: null,
    ...overrides,
    session: { placeId: 'p1', startTime: time('10:00'), endTime: time('12:30'), ...overrides.session },
    tour: {
      status: 'completed',
      tourDate: new Date('2026-05-10'),
      cancellationDeadline: new Date('2026-05-03'),
      group: { type: 'school' },
      ...overrides.tour,
    },
  }
}

const noScores = Object.fromEntries(EVALUATION_SCORE_FIELDS.map((f) => [f, null])) as Omit<Evaluation, 'buddyId' | 'tourId'>

function evaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return { buddyId: 'b1', tourId: 't1', ...noScores, ...overrides }
}

function attendance(overrides: Partial<Attendance> = {}): Attendance {
  return { buddyId: 'b1', tourId: 't1', absent: false, absenceReported: null, lateExcused: null, ...overrides }
}

function input(overrides: Partial<BuddyStatsInput> = {}): BuddyStatsInput {
  return {
    createdAt: new Date('2025-01-15T00:00:00Z'),
    bookings: [],
    deadlineOverrides: new Map(),
    evaluations: [],
    attendances: [],
    profileRatings: [],
    reflectionMoments: [],
    ...overrides,
  }
}

describe('computeBuddyStats', () => {
  it('returns zeros and nulls for a buddy with no activity', () => {
    const stats = computeBuddyStats(input(), NOW)

    expect(stats.sessionsAttended).toBe(0)
    expect(stats.attendanceRate).toBeNull()
    expect(stats.cancellationRate).toBeNull()
    expect(stats.reflectionRate).toBeNull()
    expect(stats.lastTourDate).toBeNull()
    expect(stats.daysSinceLastTour).toBeNull()
    expect(stats.averageScores.overallRating).toBeNull()
    expect(stats.sessionsByGroupType).toEqual({ school: 0, company: 0, community: 0, other: 0 })
    expect(stats.cancellationsByCategory).toEqual({ health: 0, emergency: 0, personal: 0, work: 0, other: 0 })
  })

  it('counts a confirmed booking on a completed tour as attended, per session and per tour', () => {
    const stats = computeBuddyStats(input({
      bookings: [
        booking({ tourId: 't1' }),
        booking({ tourId: 't1', session: { placeId: 'p2' } }),
        booking({ tourId: 't2', tour: { tourDate: new Date('2026-06-01') } }),
      ],
    }), NOW)

    expect(stats.sessionsAttended).toBe(3)
    expect(stats.toursAttended).toBe(2)
    expect(stats.sessionsByPlace).toEqual({ p1: 2, p2: 1 })
    expect(stats.placesGuided).toBe(2)
  })

  it('does not count bookings that were not confirmed or tours not yet completed', () => {
    const stats = computeBuddyStats(input({
      bookings: [
        booking({ status: 'declined' }),
        booking({ status: 'maybe' }),
        booking({ status: 'waitlist' }),
        booking({ tour: { status: 'published' } }),
      ],
    }), NOW)

    expect(stats.sessionsAttended).toBe(0)
    expect(stats.bookings).toBe(4)
  })

  it('voids every session of a tour the buddy was recorded absent from', () => {
    const stats = computeBuddyStats(input({
      bookings: [booking({ tourId: 't1' }), booking({ tourId: 't1' }), booking({ tourId: 't2' })],
      attendances: [attendance({ tourId: 't1', absent: true, absenceReported: false })],
    }), NOW)

    expect(stats.sessionsAttended).toBe(1)
    expect(stats.noShows).toBe(1)
    expect(stats.attendanceRate).toBe(0.5)
  })

  it('counts a reported absence as missed but not as a no-show', () => {
    const stats = computeBuddyStats(input({
      bookings: [booking({ tourId: 't1' }), booking({ tourId: 't2' })],
      attendances: [attendance({ tourId: 't1', absent: true, absenceReported: true })],
    }), NOW)

    expect(stats.noShows).toBe(0)
    expect(stats.toursMissed).toBe(1)
    expect(stats.attendanceRate).toBe(0.5)
  })

  it('counts only unexcused late arrivals, and never an early leave', () => {
    const stats = computeBuddyStats(input({
      bookings: [booking({ tourId: 't1' }), booking({ tourId: 't2' }), booking({ tourId: 't3' })],
      attendances: [
        attendance({ tourId: 't1', lateExcused: false }),
        attendance({ tourId: 't2', lateExcused: true }),
        attendance({ tourId: 't3' }),
      ],
    }), NOW)

    expect(stats.lateUnexcused).toBe(1)
    expect(stats.toursAttended).toBe(3)
  })

  it('takes first and last tour dates from attended sessions and counts days since in JST', () => {
    const stats = computeBuddyStats(input({
      bookings: [
        booking({ tourId: 't1', tour: { tourDate: new Date('2026-06-10') } }),
        booking({ tourId: 't2', tour: { tourDate: new Date('2026-02-01') } }),
        booking({ tourId: 't3', status: 'declined', tour: { tourDate: new Date('2026-06-18') } }),
      ],
    }), NOW)

    expect(stats.firstTourDate).toBe('2026-02-01')
    expect(stats.lastTourDate).toBe('2026-06-10')
    expect(stats.daysSinceLastTour).toBe(10)
  })

  it('sums minutes over attended sessions with both times and counts the rest', () => {
    const stats = computeBuddyStats(input({
      bookings: [
        booking({ tourId: 't1' }),
        booking({ tourId: 't2', session: { startTime: null } }),
        booking({ tourId: 't3', session: { endTime: null } }),
      ],
    }), NOW)

    expect(stats.minutesOnTour).toBe(150)
    expect(stats.sessionsWithoutTimes).toBe(2)
  })

  it('counts upcoming bookings on published tours from today on, by status', () => {
    const published = (tourDate: string) => ({ status: 'published', tourDate: new Date(tourDate) })
    const stats = computeBuddyStats(input({
      bookings: [
        booking({ tourId: 't1', tour: published('2026-06-20') }),
        booking({ tourId: 't2', tour: published('2026-07-01') }),
        booking({ tourId: 't3', status: 'maybe', tour: published('2026-07-02') }),
        booking({ tourId: 't4', status: 'waitlist', tour: published('2026-07-03') }),
        booking({ tourId: 't5', tour: published('2026-06-19') }),
      ],
    }), NOW)

    expect(stats.upcomingConfirmed).toBe(2)
    expect(stats.openMaybe).toBe(1)
    expect(stats.openWaitlist).toBe(1)
  })

  describe('cancellations', () => {
    const reason = (createdAt: string, extra: Partial<NonNullable<Booking['cancellationReason']>> = {}) => ({
      category: 'health',
      unavoidable: null,
      createdAt: new Date(createdAt),
      ...extra,
    })

    it('splits cancellations by review and by category', () => {
      const stats = computeBuddyStats(input({
        bookings: [
          booking({ tourId: 't1', status: 'declined', cancellationReason: reason('2026-04-01T00:00:00Z', { unavoidable: true }) }),
          booking({ tourId: 't2', status: 'declined', cancellationReason: reason('2026-04-01T00:00:00Z', { unavoidable: false, category: 'work' }) }),
          booking({ tourId: 't3', status: 'declined', cancellationReason: reason('2026-04-01T00:00:00Z', { category: 'work' }) }),
          booking({ tourId: 't4' }),
        ],
      }), NOW)

      expect(stats.cancellations).toBe(3)
      expect(stats.cancellationsUnavoidable).toBe(1)
      expect(stats.cancellationsAvoidable).toBe(1)
      expect(stats.cancellationsUnreviewed).toBe(1)
      expect(stats.cancellationsByCategory).toMatchObject({ health: 1, work: 2 })
      expect(stats.cancellationRate).toBe(0.75)
    })

    it('does not count a reason left on a booking the buddy re-booked', () => {
      const stats = computeBuddyStats(input({
        bookings: [booking({ tourId: 't1', cancellationReason: reason('2026-05-05T00:00:00Z') })],
      }), NOW)

      expect(stats.cancellations).toBe(0)
      expect(stats.lateCancellations).toBe(0)
      expect(stats.sessionsAttended).toBe(1)
      expect(stats.attendanceRate).toBe(1)
    })

    it('counts a reason recorded on the deadline day in JST as late', () => {
      // 2026-05-02T15:00Z is 2026-05-03 00:00 JST, the deadline day.
      const stats = computeBuddyStats(input({
        bookings: [
          booking({ tourId: 't1', status: 'declined', cancellationReason: reason('2026-05-02T15:00:00Z') }),
          booking({ tourId: 't2', status: 'declined', cancellationReason: reason('2026-05-02T14:59:00Z') }),
        ],
      }), NOW)

      expect(stats.lateCancellations).toBe(1)
    })

    it('measures lateness against the buddy deadline override when there is one', () => {
      const stats = computeBuddyStats(input({
        bookings: [booking({ tourId: 't1', status: 'declined', cancellationReason: reason('2026-05-05T00:00:00Z') })],
        deadlineOverrides: new Map([['t1', new Date('2026-05-07')]]),
      }), NOW)

      expect(stats.lateCancellations).toBe(0)
    })

    it('counts a late-cancelled tour as missed for the attendance rate', () => {
      const stats = computeBuddyStats(input({
        bookings: [
          booking({ tourId: 't1' }),
          booking({ tourId: 't2', status: 'declined', cancellationReason: reason('2026-05-05T00:00:00Z') }),
        ],
      }), NOW)

      expect(stats.toursMissed).toBe(1)
      expect(stats.attendanceRate).toBe(0.5)
    })

    it('does not count a tour as missed when the buddy attended another of its sessions', () => {
      const stats = computeBuddyStats(input({
        bookings: [
          booking({ tourId: 't1' }),
          booking({ tourId: 't1', status: 'declined', cancellationReason: reason('2026-05-05T00:00:00Z') }),
        ],
      }), NOW)

      expect(stats.toursMissed).toBe(0)
      expect(stats.attendanceRate).toBe(1)
    })
  })

  it('counts reflections against attended sessions and sums their moments', () => {
    const stats = computeBuddyStats(input({
      bookings: [booking({ tourId: 't1' }), booking({ tourId: 't2' })],
      reflectionMoments: [3, 0],
    }), NOW)

    expect(stats.reflections).toBe(2)
    expect(stats.reflectionRate).toBe(1)
    expect(stats.moments).toBe(3)
  })

  it('averages each score over the evaluations that set it, from every admin', () => {
    const stats = computeBuddyStats(input({
      bookings: [booking({ tourId: 't1' }), booking({ tourId: 't2' })],
      evaluations: [
        evaluation({ tourId: 't1', overallRating: 4, reliability: 5 }),
        evaluation({ tourId: 't1', overallRating: 3 }),
      ],
      profileRatings: [5, null, 4],
    }), NOW)

    expect(stats.evaluationsReceived).toBe(2)
    expect(stats.evaluationsMissing).toBe(1)
    expect(stats.averageScores.overallRating).toBe(3.5)
    expect(stats.averageScores.reliability).toBe(5)
    expect(stats.averageScores.memory).toBeNull()
    expect(stats.scoreCounts).toMatchObject({ overallRating: 2, reliability: 1, memory: 0 })
    expect(stats.profileOverallRating).toBe(4.5)
  })

  it('counts group types served from attended sessions', () => {
    const stats = computeBuddyStats(input({
      bookings: [
        booking({ tourId: 't1' }),
        booking({ tourId: 't2', tour: { group: { type: 'company' } } }),
        booking({ tourId: 't3', tour: { group: { type: 'company' } } }),
      ],
    }), NOW)

    expect(stats.sessionsByGroupType).toEqual({ school: 1, company: 2, community: 0, other: 0 })
    expect(stats.groupTypesServed).toBe(2)
  })

  it('counts whole months since registration', () => {
    expect(computeBuddyStats(input({ createdAt: new Date('2026-01-20T00:00:00Z') }), NOW).monthsSinceRegistration).toBe(5)
    expect(computeBuddyStats(input({ createdAt: new Date('2026-01-21T00:00:00Z') }), NOW).monthsSinceRegistration).toBe(4)
  })
})

describe('listBuddyStats', () => {
  const buddyRow = {
    id: 'b1',
    displayName: 'Aya',
    realName: 'Aya Tanaka',
    status: 'active',
    tier: 'buddy',
    memberType: 'buddy',
    createdAt: new Date('2025-01-15T00:00:00Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mdb.buddyProfile.findMany.mockResolvedValue([buddyRow, { ...buddyRow, id: 'b2', displayName: 'Ken' }])
    mdb.booking.findMany.mockResolvedValue([booking({ buddyId: 'b1' })])
    mdb.buddyCancellationDeadlineOverride.findMany.mockResolvedValue([])
    mdb.adminEvaluation.findMany.mockResolvedValue([])
    mdb.attendance.findMany.mockResolvedValue([])
    mdb.adminProfileEvaluation.findMany.mockResolvedValue([])
    mdb.tourReflection.findMany.mockResolvedValue([{ buddyId: 'b2', _count: { moments: 2 } }])
    mdb.place.findMany.mockResolvedValue([{ id: 'p1', nameJa: 'ホール', nameEn: 'Hall' }])
  })

  it('returns every buddy with their own numbers and the place list', async () => {
    const result = await listBuddyStats({}, NOW)

    expect(result.places).toEqual([{ id: 'p1', nameJa: 'ホール', nameEn: 'Hall' }])
    expect(result.buddies.map((b) => [b.id, b.stats.sessionsAttended, b.stats.reflections])).toEqual([
      ['b1', 1, 0],
      ['b2', 0, 1],
    ])
    expect(result.buddies[0]).toMatchObject({ displayName: 'Aya', status: 'active', createdAt: '2025-01-15T00:00:00.000Z' })
  })

  it('never selects internal notes', async () => {
    await listBuddyStats({}, NOW)

    const { select } = mdb.buddyProfile.findMany.mock.calls[0][0] as { select: Record<string, unknown> }
    expect(select).not.toHaveProperty('internalNotes')
  })

  it('scopes every query to published and completed tours in range', async () => {
    const from = new Date('2026-04-01T00:00:00Z')
    const to = new Date('2027-03-31T00:00:00Z')

    await listBuddyStats({ from, to, groupType: 'school' }, NOW)

    const tour = {
      status: { in: ['published', 'completed'] },
      tourDate: { gte: from, lte: to },
      group: { type: 'school' },
    }
    expect(mdb.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tour } }))
    expect(mdb.buddyCancellationDeadlineOverride.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tour } }))
    expect(mdb.adminEvaluation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tour } }))
    expect(mdb.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tour } }))
    expect(mdb.tourReflection.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { session: { tour } } }))
  })

  it('scopes to one place through the session', async () => {
    await listBuddyStats({ placeId: 'p1' }, NOW)

    expect(whereOf(mdb.booking.findMany)).toMatchObject({ session: { placeId: 'p1' } })
    expect(whereOf(mdb.adminEvaluation.findMany)).toMatchObject({ tour: { sessions: { some: { placeId: 'p1' } } } })
    expect(whereOf(mdb.tourReflection.findMany)).toMatchObject({ session: { placeId: 'p1' } })
  })

  it('under a place scope, drops evaluations and absences of tours the buddy held no session at there', async () => {
    mdb.booking.findMany.mockResolvedValue([booking({ buddyId: 'b1', tourId: 't1' })])
    mdb.adminEvaluation.findMany.mockResolvedValue([
      evaluation({ buddyId: 'b1', tourId: 't1', overallRating: 4 }),
      evaluation({ buddyId: 'b1', tourId: 't2', overallRating: 2 }),
    ])
    mdb.attendance.findMany.mockResolvedValue([attendance({ buddyId: 'b1', tourId: 't2', absent: true, absenceReported: false })])

    const [aya] = (await listBuddyStats({ placeId: 'p1' }, NOW)).buddies

    expect(aya.stats.evaluationsReceived).toBe(1)
    expect(aya.stats.noShows).toBe(0)
    expect(aya.stats.attendanceRate).toBe(1)
  })

  it('keeps evaluations without a booking when no place is scoped', async () => {
    mdb.booking.findMany.mockResolvedValue([])
    mdb.adminEvaluation.findMany.mockResolvedValue([evaluation({ buddyId: 'b1', tourId: 't2', overallRating: 4 })])

    const [aya] = (await listBuddyStats({}, NOW)).buddies

    expect(aya.stats.evaluationsReceived).toBe(1)
  })
})

describe('getBuddyStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.booking.findMany.mockResolvedValue([])
    mdb.buddyCancellationDeadlineOverride.findMany.mockResolvedValue([])
    mdb.adminEvaluation.findMany.mockResolvedValue([])
    mdb.attendance.findMany.mockResolvedValue([])
    mdb.adminProfileEvaluation.findMany.mockResolvedValue([])
    mdb.tourReflection.findMany.mockResolvedValue([])
  })

  it('reads only that buddy', async () => {
    mdb.buddyProfile.findMany.mockResolvedValue([
      { id: 'b1', displayName: 'Aya', realName: '', status: 'active', tier: null, memberType: 'buddy', createdAt: new Date() },
    ])

    const stats = await getBuddyStats('b1', NOW)

    expect(stats).not.toBeNull()
    expect(mdb.buddyProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b1' } }))
    expect(whereOf(mdb.booking.findMany)).toMatchObject({ buddyId: 'b1' })
  })

  it('returns null for an unknown buddy', async () => {
    mdb.buddyProfile.findMany.mockResolvedValue([])

    expect(await getBuddyStats('missing', NOW)).toBeNull()
  })
})
