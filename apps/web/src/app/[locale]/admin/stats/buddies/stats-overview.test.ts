import { describe, it, expect } from 'vitest'
import type { AdminBuddyStatsRow, BuddyStats } from '@peace-buddy/types'
import { buildOverview } from './stats-overview'

const NOW = new Date('2026-09-26T03:00:00Z')

function stats(overrides: Partial<BuddyStats> = {}): BuddyStats {
  return {
    sessionsAttended: 0, toursAttended: 0, noShows: 0, lateUnexcused: 0, toursMissed: 0, attendanceRate: null, upcomingConfirmed: 0,
    openMaybe: 0, openWaitlist: 0, firstTourDate: null, lastTourDate: null, daysSinceLastTour: null,
    minutesOnTour: 0, sessionsWithoutTimes: 0, bookings: 0, cancellations: 0, lateCancellations: 0,
    cancellationsUnavoidable: 0, cancellationsAvoidable: 0, cancellationsUnreviewed: 0,
    cancellationsByCategory: { health: 0, emergency: 0, personal: 0, work: 0, other: 0 },
    cancellationRate: null, reflections: 0, reflectionRate: null, moments: 0, evaluationsReceived: 0,
    evaluationsMissing: 0,
    averageScores: {
      overallRating: null, reliability: null, communication: null, groupEngagement: null, memory: null,
      knowledge: null, dedication: null, dialogue: null, adaptability: null, confidence: null,
    },
    scoreCounts: {
      overallRating: 0, reliability: 0, communication: 0, groupEngagement: 0, memory: 0,
      knowledge: 0, dedication: 0, dialogue: 0, adaptability: 0, confidence: 0,
    },
    profileOverallRating: null, placesGuided: 0, sessionsByPlace: {}, groupTypesServed: 0,
    sessionsByGroupType: { school: 0, company: 0, community: 0, other: 0 }, monthsSinceRegistration: 0,
    ...overrides,
  }
}

let seq = 0
function row(overrides: Partial<Omit<AdminBuddyStatsRow, 'stats'>> & { stats?: Partial<BuddyStats> } = {}): AdminBuddyStatsRow {
  seq += 1
  return {
    id: `b${seq}`, displayName: `B${seq}`, realName: '', status: 'active', tier: 'buddy', memberType: 'buddy',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
    stats: stats(overrides.stats),
  }
}

const ids = (rows: AdminBuddyStatsRow[], match: (r: AdminBuddyStatsRow) => boolean) =>
  rows.filter(match).map((r) => r.displayName)

describe('buildOverview', () => {
  it('pools rates over every buddy instead of averaging each buddy rate', () => {
    const rows = [
      row({ stats: { toursAttended: 9, toursMissed: 1, sessionsAttended: 9, reflections: 9, bookings: 10, cancellations: 1 } }),
      row({ stats: { toursAttended: 0, toursMissed: 1, bookings: 1, cancellations: 1 } }),
    ]
    const overview = buildOverview(rows, [], NOW)

    expect(overview.attendanceRate).toBeCloseTo(9 / 11)
    expect(overview.cancellationRate).toBeCloseTo(2 / 11)
    expect(overview.reflectionRate).toBe(1)
    expect(overview.everAttended).toBe(1)
  })

  it('weights each criterion average by how many evaluations set it', () => {
    const rows = [
      row({ stats: { averageScores: { ...stats().averageScores, communication: 4 }, scoreCounts: { ...stats().scoreCounts, communication: 10 } } }),
      row({ stats: { averageScores: { ...stats().averageScores, communication: 2 }, scoreCounts: { ...stats().scoreCounts, communication: 1 } } }),
    ]
    const communication = buildOverview(rows, [], NOW).scores.find((s) => s.score === 'communication')

    expect(communication?.average).toBeCloseTo(42 / 11)
    expect(communication?.count).toBe(11)
  })

  it('leaves rates and averages empty when there is nothing to divide by', () => {
    const overview = buildOverview([row()], [], NOW)

    expect(overview.attendanceRate).toBeNull()
    expect(overview.scores.every((s) => s.average === null)).toBe(true)
  })

  it('groups buddies by sessions attended and by time since their last tour', () => {
    const rows = [
      row({ displayName: 'none', stats: { sessionsAttended: 0, daysSinceLastTour: null } }),
      row({ displayName: 'two', stats: { sessionsAttended: 2, daysSinceLastTour: 30 } }),
      row({ displayName: 'six', stats: { sessionsAttended: 6, daysSinceLastTour: 31 } }),
      row({ displayName: 'many', stats: { sessionsAttended: 20, daysSinceLastTour: 181 } }),
    ]
    const overview = buildOverview(rows, [], NOW)

    expect(overview.activity.map((b) => [b.id, b.value])).toEqual([['0', 1], ['1–2', 1], ['3–5', 0], ['6–10', 1], ['11+', 1]])
    expect(ids(rows, overview.activity[3].match)).toEqual(['six'])
    expect(overview.recency.map((b) => [b.id, b.value])).toEqual([
      ['within30', 1], ['within90', 1], ['within180', 0], ['older', 1], ['never', 1],
    ])
    expect(ids(rows, overview.recency[4].match)).toEqual(['none'])
  })

  it('counts buddies per tier, with trainees under no tier', () => {
    const overview = buildOverview([row({ tier: 'star' }), row({ tier: null })], [], NOW)

    expect(overview.tiers.map((b) => [b.id, b.value])).toEqual([
      ['junior', 0], ['buddy', 0], ['star', 1], ['blackstar', 0], ['none', 1],
    ])
  })

  it('totals cancellations, places and group types largest first, each sorting by its column', () => {
    const place = { id: 'p1', nameJa: 'ホール', nameEn: 'Hall' }
    const rows = [
      row({ stats: { cancellationsByCategory: { ...stats().cancellationsByCategory, work: 2, health: 1 }, sessionsByPlace: { p1: 3 } } }),
      row({ stats: { cancellationsByCategory: { ...stats().cancellationsByCategory, work: 1 } } }),
    ]
    const overview = buildOverview(rows, [place], NOW)

    expect(overview.categories.slice(0, 2).map((b) => [b.id, b.value])).toEqual([['work', 3], ['health', 1]])
    expect(overview.categories[0].sortField).toBe('cancellations.work')
    expect(overview.places).toEqual([expect.objectContaining({ id: 'p1', value: 3, sortField: 'place.p1' })])
  })

  it('counts registrations per JST month through this month, months with none included', () => {
    const rows = [
      row({ displayName: 'july', createdAt: '2026-06-30T15:00:00.000Z' }),
      row({ displayName: 'sept', createdAt: '2026-09-10T00:00:00.000Z' }),
    ]
    const overview = buildOverview(rows, [], NOW)

    expect(overview.registrations.map((b) => [b.id, b.value])).toEqual([['2026-07', 1], ['2026-08', 0], ['2026-09', 1]])
    expect(ids(rows, overview.registrations[0].match)).toEqual(['july'])
  })
})
