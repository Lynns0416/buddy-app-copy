import type { Prisma } from '@prisma/client'
import {
  BookingStatusSchema,
  CancellationCategorySchema,
  EVALUATION_SCORE_FIELDS,
  GroupTypeSchema,
  TourStatusSchema,
  getTodayJst,
  type AdminBuddyStatsResponse,
  type AdminBuddyStatsRow,
  type BuddyStats,
  type BuddyStatus,
  type BuddyTier,
  type CancellationCategory,
  type EvaluationScoreField,
  type GroupType,
  type MemberType,
} from '@peace-buddy/types'
import { db } from '../lib/db'
import { placeSummarySelect } from '../lib/sessionPlaces'
import type { BuddyStatsScope } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

// Stats read tours a buddy could have booked. A draft tour takes no bookings;
// a cancelled tour's bookings say nothing about the buddy.
const COUNTED_TOUR_STATUSES = [TourStatusSchema.enum.published, TourStatusSchema.enum.completed]

function tourWhere(scope: BuddyStatsScope): Prisma.TourWhereInput {
  return {
    status: { in: COUNTED_TOUR_STATUSES },
    ...(scope.from || scope.to
      ? { tourDate: { ...(scope.from ? { gte: scope.from } : {}), ...(scope.to ? { lte: scope.to } : {}) } }
      : {}),
    ...(scope.groupType ? { group: { type: scope.groupType } } : {}),
  }
}

const scoreSelect = Object.fromEntries(EVALUATION_SCORE_FIELDS.map((f) => [f, true])) as Record<EvaluationScoreField, true>

type BookingRow = {
  buddyId: string
  tourId: string
  status: string
  session: { placeId: string; startTime: Date | null; endTime: Date | null }
  tour: { status: string; tourDate: Date; cancellationDeadline: Date; group: { type: string } }
  cancellationReason: { category: string; unavoidable: boolean | null; createdAt: Date } | null
}

type EvaluationRow = { buddyId: string; tourId: string; absentWithoutReport: boolean } & Record<EvaluationScoreField, number | null>

export type BuddyStatsInput = {
  createdAt: Date
  bookings: BookingRow[]
  deadlineOverrides: Map<string, Date>
  evaluations: EvaluationRow[]
  profileRatings: (number | null)[]
  reflectionMoments: number[]
}

function dateOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole
}

function average(values: (number | null)[]): number | null {
  const scored = values.filter((v): v is number => v !== null)
  return scored.length === 0 ? null : scored.reduce((sum, v) => sum + v, 0) / scored.length
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0))
}

function countBy<K extends string>(keys: readonly K[], values: K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  for (const v of values) counts[v] += 1
  return counts
}

// One buddy's numbers from the rows already scoped to the request. Pure, so the
// counting rules are tested without Prisma (PRD §11.4 "Buddy Stats").
export function computeBuddyStats(input: BuddyStatsInput, now: Date = new Date()): BuddyStats {
  const today = getTodayJst(now)
  const { bookings, evaluations } = input

  // A no-show is recorded per tour, on the evaluation, so it voids every
  // session the buddy held on that tour.
  const absentTours = new Set(evaluations.filter((e) => e.absentWithoutReport).map((e) => e.tourId))
  const attended = bookings.filter(
    (b) =>
      b.status === BookingStatusSchema.enum.confirmed &&
      b.tour.status === TourStatusSchema.enum.completed &&
      !absentTours.has(b.tourId),
  )
  const attendedTours = new Set(attended.map((b) => b.tourId))

  const upcoming = bookings.filter(
    (b) => b.tour.status === TourStatusSchema.enum.published && dateOf(b.tour.tourDate) >= today,
  )

  const attendedDates = attended.map((b) => dateOf(b.tour.tourDate)).sort()
  const firstTourDate = attendedDates[0] ?? null
  const lastTourDate = attendedDates[attendedDates.length - 1] ?? null

  let minutesVolunteered = 0
  let sessionsWithoutTimes = 0
  for (const b of attended) {
    const { startTime, endTime } = b.session
    if (startTime && endTime && endTime > startTime) {
      minutesVolunteered += (endTime.getTime() - startTime.getTime()) / 60000
    } else {
      sessionsWithoutTimes += 1
    }
  }

  // A re-book reuses the booking and leaves its old reason in place, so only a
  // booking that is still declined counts as cancelled.
  const cancelled = bookings.flatMap((b) =>
    b.cancellationReason && b.status === BookingStatusSchema.enum.declined
      ? [{ booking: b, reason: b.cancellationReason }]
      : [],
  )
  const reasons = cancelled.map((c) => c.reason)
  // Late means the reason was recorded on or after the buddy's effective
  // deadline, the same boundary the booking service enforces.
  const late = cancelled
    .filter(({ booking, reason }) => {
      const deadline = input.deadlineOverrides.get(booking.tourId) ?? booking.tour.cancellationDeadline
      return getTodayJst(reason.createdAt) >= dateOf(deadline)
    })
    .map((c) => c.booking)

  // Attendance is per tour: of the tours the buddy was held to, how many they
  // turned up for. A tour missed by a no-show or a late cancellation counts
  // once, and not at all if the buddy still attended another of its sessions.
  const missedTours = new Set([...absentTours, ...late.map((b) => b.tourId)].filter((id) => !attendedTours.has(id)))

  const evaluatedTours = new Set(evaluations.map((e) => e.tourId))
  const sessionsByPlace: Record<string, number> = {}
  for (const b of attended) sessionsByPlace[b.session.placeId] = (sessionsByPlace[b.session.placeId] ?? 0) + 1
  const sessionsByGroupType = countBy(GroupTypeSchema.options, attended.map((b) => b.tour.group.type as GroupType))

  const averageScores = Object.fromEntries(
    EVALUATION_SCORE_FIELDS.map((f) => [f, average(evaluations.map((e) => e[f]))]),
  ) as Record<EvaluationScoreField, number | null>
  const scoreCounts = Object.fromEntries(
    EVALUATION_SCORE_FIELDS.map((f) => [f, evaluations.filter((e) => e[f] !== null).length]),
  ) as Record<EvaluationScoreField, number>

  return {
    sessionsAttended: attended.length,
    toursAttended: attendedTours.size,
    noShows: absentTours.size,
    toursMissed: missedTours.size,
    attendanceRate: ratio(attendedTours.size, attendedTours.size + missedTours.size),
    upcomingConfirmed: upcoming.filter((b) => b.status === BookingStatusSchema.enum.confirmed).length,
    openMaybe: upcoming.filter((b) => b.status === BookingStatusSchema.enum.maybe).length,
    openWaitlist: upcoming.filter((b) => b.status === BookingStatusSchema.enum.waitlist).length,
    firstTourDate,
    lastTourDate,
    daysSinceLastTour: lastTourDate
      ? Math.round((Date.parse(today) - Date.parse(lastTourDate)) / DAY_MS)
      : null,
    minutesVolunteered,
    sessionsWithoutTimes,
    bookings: bookings.length,
    cancellations: reasons.length,
    lateCancellations: late.length,
    cancellationsUnavoidable: reasons.filter((r) => r.unavoidable === true).length,
    cancellationsAvoidable: reasons.filter((r) => r.unavoidable === false).length,
    cancellationsUnreviewed: reasons.filter((r) => r.unavoidable === null).length,
    cancellationsByCategory: countBy(
      CancellationCategorySchema.options,
      reasons.map((r) => r.category as CancellationCategory),
    ),
    cancellationRate: ratio(reasons.length, bookings.length),
    reflections: input.reflectionMoments.length,
    reflectionRate: ratio(input.reflectionMoments.length, attended.length),
    moments: input.reflectionMoments.reduce((sum, n) => sum + n, 0),
    evaluationsReceived: evaluations.length,
    evaluationsMissing: [...attendedTours].filter((id) => !evaluatedTours.has(id)).length,
    averageScores,
    scoreCounts,
    profileOverallRating: average(input.profileRatings),
    placesGuided: Object.keys(sessionsByPlace).length,
    sessionsByPlace,
    groupTypesServed: Object.values(sessionsByGroupType).filter((n) => n > 0).length,
    sessionsByGroupType,
    monthsSinceRegistration: monthsBetween(getTodayJst(input.createdAt), today),
  }
}

type BuddyRow = {
  id: string
  displayName: string
  realName: string
  status: string
  tier: string | null
  memberType: string
  createdAt: Date
}

// Every query is scoped once and grouped in memory: the roster is small, and
// one query per model keeps the page to a fixed number of round trips.
async function loadStats(
  buddyId: string | undefined,
  scope: BuddyStatsScope,
  now: Date,
): Promise<{ buddy: BuddyRow; stats: BuddyStats }[]> {
  const tour = tourWhere(scope)
  const buddyIdFilter = buddyId ? { buddyId } : {}

  const [buddies, bookings, overrides, evaluations, profileEvaluations, reflections] = await Promise.all([
    db.buddyProfile.findMany({
      where: buddyId ? { id: buddyId } : {},
      select: { id: true, displayName: true, realName: true, status: true, tier: true, memberType: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    db.booking.findMany({
      where: { ...buddyIdFilter, tour, ...(scope.placeId ? { session: { placeId: scope.placeId } } : {}) },
      select: {
        buddyId: true,
        tourId: true,
        status: true,
        session: { select: { placeId: true, startTime: true, endTime: true } },
        tour: { select: { status: true, tourDate: true, cancellationDeadline: true, group: { select: { type: true } } } },
        cancellationReason: { select: { category: true, unavoidable: true, createdAt: true } },
      },
    }),
    db.buddyCancellationDeadlineOverride.findMany({
      where: { ...buddyIdFilter, tour },
      select: { buddyId: true, tourId: true, deadline: true },
    }),
    db.adminEvaluation.findMany({
      where: {
        ...buddyIdFilter,
        tour: { ...tour, ...(scope.placeId ? { sessions: { some: { placeId: scope.placeId } } } : {}) },
      },
      select: { buddyId: true, tourId: true, absentWithoutReport: true, ...scoreSelect },
    }),
    db.adminProfileEvaluation.findMany({
      where: buddyIdFilter,
      select: { buddyId: true, overallRating: true },
    }),
    db.tourReflection.findMany({
      where: { ...buddyIdFilter, session: { tour, ...(scope.placeId ? { placeId: scope.placeId } : {}) } },
      select: { buddyId: true, _count: { select: { moments: true } } },
    }),
  ])

  function byBuddy<T extends { buddyId: string }>(rows: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>()
    for (const row of rows) map.set(row.buddyId, [...(map.get(row.buddyId) ?? []), row])
    return map
  }

  // A place scope keeps only the buddy's own sessions there, but an evaluation
  // is per tour. Keep it only for a tour the buddy held a session at that place,
  // so a no-show at another place of the same tour does not count against it.
  const bookedTours = new Set(bookings.map((b) => `${b.buddyId}:${b.tourId}`))
  const evaluationsInScope = scope.placeId
    ? evaluations.filter((e) => bookedTours.has(`${e.buddyId}:${e.tourId}`))
    : evaluations

  const bookingsBy = byBuddy(bookings)
  const overridesBy = byBuddy(overrides)
  const evaluationsBy = byBuddy(evaluationsInScope)
  const profileBy = byBuddy(profileEvaluations)
  const reflectionsBy = byBuddy(reflections)

  return buddies.map((buddy) => ({
    buddy,
    stats: computeBuddyStats(
      {
        createdAt: buddy.createdAt,
        bookings: bookingsBy.get(buddy.id) ?? [],
        deadlineOverrides: new Map((overridesBy.get(buddy.id) ?? []).map((o) => [o.tourId, o.deadline])),
        evaluations: evaluationsBy.get(buddy.id) ?? [],
        profileRatings: (profileBy.get(buddy.id) ?? []).map((p) => p.overallRating),
        reflectionMoments: (reflectionsBy.get(buddy.id) ?? []).map((r) => r._count.moments),
      },
      now,
    ),
  }))
}

export async function listBuddyStats(scope: BuddyStatsScope, now: Date = new Date()): Promise<AdminBuddyStatsResponse> {
  const [rows, places] = await Promise.all([
    loadStats(undefined, scope, now),
    db.place.findMany({ select: placeSummarySelect, orderBy: { sortOrder: 'asc' } }),
  ])
  const buddies: AdminBuddyStatsRow[] = rows.map(({ buddy, stats }) => ({
    id: buddy.id,
    displayName: buddy.displayName,
    realName: buddy.realName,
    status: buddy.status as BuddyStatus,
    tier: buddy.tier as BuddyTier | null,
    memberType: buddy.memberType as MemberType,
    createdAt: buddy.createdAt.toISOString(),
    stats,
  }))
  return { places, buddies }
}

// All-time numbers for one buddy, for the detail page.
export async function getBuddyStats(buddyId: string, now: Date = new Date()): Promise<BuddyStats | null> {
  const [row] = await loadStats(buddyId, {}, now)
  return row?.stats ?? null
}
