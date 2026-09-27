import type {
  AdminBuddyStatsRow,
  BuddyTier,
  CancellationCategory,
  EvaluationScoreField,
  GroupType,
  PlaceSummary,
} from '@peace-buddy/types'
import {
  BuddyTierSchema,
  CancellationCategorySchema,
  EVALUATION_SCORE_FIELDS,
  GroupTypeSchema,
  getTodayJst,
} from '@peace-buddy/types'
import { nextMonth, ratio } from '../stats-helpers'

// The overview reads the rows the table shows (scope and row filters applied),
// so every figure adds up to the table below it (PRD §11.4 "Overview").

// One bar or segment. Clicking it narrows the table to `match` and sorts by
// `sortField` when there is one.
export type OverviewBucket<K extends string = string> = {
  id: K
  value: number
  match: (row: AdminBuddyStatsRow) => boolean
  sortField?: string
}

// What a click on the overview did to the table: the chip names it, `match`
// narrows the rows, `sortField` sorts them largest first.
export type OverviewFocus = {
  label: string
  match?: (row: AdminBuddyStatsRow) => boolean
  sortField?: string
}

export type OverviewScore = { score: EvaluationScoreField; average: number | null; count: number }

export type BuddyStatsOverview = {
  buddies: number
  everAttended: number
  sessionsAttended: number
  minutesVolunteered: number
  // Pooled over every buddy's tours, not an average of each buddy's rate, so a
  // buddy with one tour weighs no more than their one tour.
  attendanceRate: number | null
  noShows: number
  lateCancellations: number
  cancellationRate: number | null
  reflectionRate: number | null
  cancellationsUnreviewed: number
  evaluationsMissing: number
  tiers: OverviewBucket<BuddyTier | typeof NO_TIER>[]
  activity: OverviewBucket[]
  recency: OverviewBucket<RecencyId>[]
  categories: OverviewBucket<CancellationCategory>[]
  places: OverviewBucket[]
  groupTypes: OverviewBucket<GroupType>[]
  scores: OverviewScore[]
  registrations: OverviewBucket[]
}

export const NO_TIER = 'none' as const

// Sessions attended, lower bound inclusive; the last one is open-ended.
const ACTIVITY_BOUNDS = [0, 1, 3, 6, 11]

// Days since the last tour, upper bound inclusive; buddies past the last one
// are `older`, and buddies who never attended are `never`.
const RECENCY_BOUNDS = [
  { id: 'within30', max: 30 },
  { id: 'within90', max: 90 },
  { id: 'within180', max: 180 },
] as const

export type RecencyId = (typeof RECENCY_BOUNDS)[number]['id'] | 'older' | 'never'

function sum(rows: AdminBuddyStatsRow[], pick: (row: AdminBuddyStatsRow) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0)
}

export function activityLabel(index: number): string {
  const min = ACTIVITY_BOUNDS[index]
  const next = ACTIVITY_BOUNDS[index + 1]
  if (next === undefined) return `${min}+`
  return next - 1 === min ? String(min) : `${min}–${next - 1}`
}

function activityBuckets(rows: AdminBuddyStatsRow[]): OverviewBucket[] {
  return ACTIVITY_BOUNDS.map((min, i) => {
    const next = ACTIVITY_BOUNDS[i + 1] ?? Infinity
    const match = (r: AdminBuddyStatsRow) => r.stats.sessionsAttended >= min && r.stats.sessionsAttended < next
    return { id: activityLabel(i), value: rows.filter(match).length, match, sortField: 'sessionsAttended' }
  })
}

function recencyBuckets(rows: AdminBuddyStatsRow[]): OverviewBucket<RecencyId>[] {
  const days = (r: AdminBuddyStatsRow) => r.stats.daysSinceLastTour
  let min = 0
  const bounded = RECENCY_BOUNDS.map(({ id, max }) => {
    const lower = min
    min = max + 1
    const match = (r: AdminBuddyStatsRow) => {
      const d = days(r)
      return d !== null && d >= lower && d <= max
    }
    return { id, match }
  })
  const last = RECENCY_BOUNDS[RECENCY_BOUNDS.length - 1].max
  const all: { id: RecencyId; match: (r: AdminBuddyStatsRow) => boolean }[] = [
    ...bounded,
    { id: 'older', match: (r: AdminBuddyStatsRow) => (days(r) ?? -1) > last },
    { id: 'never', match: (r: AdminBuddyStatsRow) => days(r) === null },
  ]
  return all.map(({ id, match }) => ({ id, value: rows.filter(match).length, match, sortField: 'daysSinceLastTour' }))
}

function tierBuckets(rows: AdminBuddyStatsRow[]): OverviewBucket<BuddyTier | typeof NO_TIER>[] {
  const ids: (BuddyTier | typeof NO_TIER)[] = [...BuddyTierSchema.options, NO_TIER]
  return ids.map((id) => {
    const match = (r: AdminBuddyStatsRow) => (r.tier ?? NO_TIER) === id
    return { id, value: rows.filter(match).length, match }
  })
}

// A bar per key, largest first; clicking one keeps the buddies with any.
function totalsBy<K extends string>(
  rows: AdminBuddyStatsRow[],
  keys: readonly K[],
  pick: (row: AdminBuddyStatsRow, key: K) => number,
  columnId: (key: K) => string,
): OverviewBucket<K>[] {
  return keys
    .map((key) => ({
      id: key,
      value: sum(rows, (r) => pick(r, key)),
      match: (r: AdminBuddyStatsRow) => pick(r, key) > 0,
      sortField: columnId(key),
    }))
    .sort((a, b) => b.value - a.value)
}

// Weighted by how many evaluations set the criterion, so a buddy with ten
// evaluations counts ten times as much as a buddy with one.
function pooledScores(rows: AdminBuddyStatsRow[]): OverviewScore[] {
  return EVALUATION_SCORE_FIELDS.map((score) => {
    let total = 0
    let count = 0
    for (const r of rows) {
      const average = r.stats.averageScores[score]
      const n = r.stats.scoreCounts[score]
      if (average === null || n === 0) continue
      total += average * n
      count += n
    }
    return { score, average: ratio(total, count), count }
  })
}

function monthOf(iso: string): string {
  return getTodayJst(new Date(iso)).slice(0, 7)
}

// Every month from the first registration in view to this month in JST,
// including months nobody joined.
function registrationBuckets(rows: AdminBuddyStatsRow[], now: Date): OverviewBucket[] {
  if (rows.length === 0) return []
  const months = rows.map((r) => monthOf(r.createdAt))
  const thisMonth = getTodayJst(now).slice(0, 7)
  const buckets: OverviewBucket[] = []
  for (let month = [...months].sort()[0]; month <= thisMonth; month = nextMonth(month)) {
    const key = month
    const match = (r: AdminBuddyStatsRow) => monthOf(r.createdAt) === key
    buckets.push({ id: key, value: months.filter((m) => m === key).length, match, sortField: 'createdAt' })
  }
  return buckets
}

export function buildOverview(
  rows: AdminBuddyStatsRow[],
  places: PlaceSummary[],
  now: Date = new Date(),
): BuddyStatsOverview {
  const toursAttended = sum(rows, (r) => r.stats.toursAttended)
  const toursMissed = sum(rows, (r) => r.stats.toursMissed)
  const sessionsAttended = sum(rows, (r) => r.stats.sessionsAttended)
  return {
    buddies: rows.length,
    everAttended: rows.filter((r) => r.stats.sessionsAttended > 0).length,
    sessionsAttended,
    minutesVolunteered: sum(rows, (r) => r.stats.minutesVolunteered),
    attendanceRate: ratio(toursAttended, toursAttended + toursMissed),
    noShows: sum(rows, (r) => r.stats.noShows),
    lateCancellations: sum(rows, (r) => r.stats.lateCancellations),
    cancellationRate: ratio(sum(rows, (r) => r.stats.cancellations), sum(rows, (r) => r.stats.bookings)),
    reflectionRate: ratio(sum(rows, (r) => r.stats.reflections), sessionsAttended),
    cancellationsUnreviewed: sum(rows, (r) => r.stats.cancellationsUnreviewed),
    evaluationsMissing: sum(rows, (r) => r.stats.evaluationsMissing),
    tiers: tierBuckets(rows),
    activity: activityBuckets(rows),
    recency: recencyBuckets(rows),
    categories: totalsBy(
      rows,
      CancellationCategorySchema.options,
      (r, k) => r.stats.cancellationsByCategory[k],
      (k) => `cancellations.${k}`,
    ),
    places: totalsBy(
      rows,
      places.map((p) => p.id),
      (r, k) => r.stats.sessionsByPlace[k] ?? 0,
      (k) => `place.${k}`,
    ),
    groupTypes: totalsBy(
      rows,
      GroupTypeSchema.options,
      (r, k) => r.stats.sessionsByGroupType[k],
      (k) => `groupType.${k}`,
    ),
    scores: pooledScores(rows),
    registrations: registrationBuckets(rows, now),
  }
}
