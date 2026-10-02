import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdminBuddyStatsRow, BuddyStats } from '@peace-buddy/types'
import {
  buildStatColumns,
  defaultBuddyStatsFilters,
  defaultVisibleColumns,
  emptyBuddyStatsScope,
  fetchBuddyStats,
  filterBuddyStats,
  formatStat,
  loadVisibleColumns,
  nextStatSort,
  saveVisibleColumns,
  sortBuddyStats,
  statDescription,
  statLabel,
  type StatTranslators,
} from './admin.buddy-stats'

vi.mock('@/i18n/routing', () => ({ routing: { defaultLocale: 'en' } }))

vi.mock('@/lib/api-client', () => ({ apiClient: { listBuddyStats: vi.fn() } }))

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return { ApiError }
})

import { apiClient } from '@/lib/api-client'

const echo = (ns: string) => (key: string, values?: Record<string, string>) =>
  values ? `${ns}.${key}(${Object.values(values).join(',')})` : `${ns}.${key}`

const tr: StatTranslators = {
  t: echo('adminBuddyStats'),
  tEval: echo('adminEvaluations'),
  tBuddies: echo('adminBuddies'),
  tGroupType: echo('groupType'),
  tStatus: echo('buddyStatus'),
  tTier: echo('buddyTier'),
}

const baseStats = {
  sessionsAttended: 0,
  toursAttended: 0,
  noShows: 0,
  attendanceRate: null,
  lastTourDate: null,
  minutesOnTour: 0,
  averageScores: { overallRating: null },
  sessionsByPlace: {},
} as unknown as BuddyStats

function row(overrides: Partial<Omit<AdminBuddyStatsRow, 'stats'>> & { stats?: Partial<BuddyStats> } = {}): AdminBuddyStatsRow {
  return {
    id: 'b1',
    displayName: 'Aya',
    realName: 'Aya Tanaka',
    status: 'active',
    tier: 'buddy',
    memberType: 'buddy',
    createdAt: '2025-01-15T00:00:00.000Z',
    ...overrides,
    stats: { ...baseStats, ...overrides.stats },
  }
}

const place = { id: 'p1', nameJa: 'ホール', nameEn: 'Hall' }
const columns = buildStatColumns([place])
const col = (id: string) => {
  const found = columns.find((c) => c.id === id)
  if (!found) throw new Error(`no column ${id}`)
  return found
}

describe('buildStatColumns', () => {
  it('gives every column a unique id', () => {
    const ids = columns.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('adds one column per place, reading that place’s session count', () => {
    const r = row({ stats: { sessionsByPlace: { p1: 4 } } })
    expect(col('place.p1').value(r)).toBe(4)
    expect(col('place.p1').value(row())).toBe(0)
  })

  it('shows the agreed columns by default', () => {
    expect(defaultVisibleColumns(columns)).toEqual([
      'tier',
      'sessionsAttended',
      'toursAttended',
      'noShows',
      'lateUnexcused',
      'attendanceRate',
      'upcomingConfirmed',
      'lastTourDate',
      'daysSinceLastTour',
      'cancellations',
      'lateCancellations',
      'reflections',
    ])
  })
})

describe('filterBuddyStats', () => {
  const rows = [
    row({ id: 'active' }),
    row({ id: 'trainee', status: 'trainee', tier: null }),
    row({ id: 'staff', memberType: 'plab_member' }),
    row({ id: 'star', tier: 'star', displayName: 'Ken', realName: 'Ken Sato' }),
  ]
  const ids = (filtered: AdminBuddyStatsRow[]) => filtered.map((r) => r.id)

  it('shows active buddies and leaves PLAB members out by default', () => {
    expect(ids(filterBuddyStats(rows, defaultBuddyStatsFilters))).toEqual(['active', 'star'])
  })

  it('includes PLAB members when asked', () => {
    expect(ids(filterBuddyStats(rows, { ...defaultBuddyStatsFilters, includePlabMembers: true }))).toContain('staff')
  })

  it('shows every status when none is ticked', () => {
    expect(ids(filterBuddyStats(rows, { ...defaultBuddyStatsFilters, statuses: [] }))).toContain('trainee')
  })

  it('filters by tier, leaving out buddies with none', () => {
    expect(ids(filterBuddyStats(rows, { ...defaultBuddyStatsFilters, statuses: [], tiers: ['star'] }))).toEqual(['star'])
  })

  it('searches display and real names', () => {
    expect(ids(filterBuddyStats(rows, { ...defaultBuddyStatsFilters, search: 'sato' }))).toEqual(['star'])
  })
})

describe('sortBuddyStats', () => {
  const rows = [
    row({ id: 'none', stats: { attendanceRate: null } }),
    row({ id: 'low', stats: { attendanceRate: 0.5 } }),
    row({ id: 'high', stats: { attendanceRate: 1 } }),
  ]
  const ids = (sorted: AdminBuddyStatsRow[]) => sorted.map((r) => r.id)

  it('sorts numbers and keeps nulls last in both directions', () => {
    expect(ids(sortBuddyStats(rows, columns, 'attendanceRate', 'desc'))).toEqual(['high', 'low', 'none'])
    expect(ids(sortBuddyStats(rows, columns, 'attendanceRate', 'asc'))).toEqual(['low', 'high', 'none'])
  })

  it('sorts tier by rank, not spelling', () => {
    const tiers = [row({ id: 'star', tier: 'star' }), row({ id: 'junior', tier: 'junior' }), row({ id: 'buddy', tier: 'buddy' })]
    expect(ids(sortBuddyStats(tiers, columns, 'tier', 'asc'))).toEqual(['junior', 'buddy', 'star'])
  })

  it('sorts by name', () => {
    const named = [row({ id: 'k', displayName: 'Ken' }), row({ id: 'a', displayName: 'Aya' })]
    expect(ids(sortBuddyStats(named, columns, 'displayName', 'asc'))).toEqual(['a', 'k'])
  })
})

describe('nextStatSort', () => {
  it('starts a number column descending and a text column ascending', () => {
    const current = { field: 'displayName', dir: 'asc' as const }
    expect(nextStatSort(current, 'sessionsAttended', columns)).toEqual({ field: 'sessionsAttended', dir: 'desc' })
    expect(nextStatSort(current, 'tier', columns)).toEqual({ field: 'tier', dir: 'asc' })
  })

  it('flips the direction of the current column', () => {
    expect(nextStatSort({ field: 'noShows', dir: 'desc' }, 'noShows', columns)).toEqual({ field: 'noShows', dir: 'asc' })
  })
})

describe('formatStat', () => {
  it('shows a dash when there is nothing to compute from', () => {
    expect(formatStat(col('attendanceRate'), row(), tr)).toBe('—')
    expect(formatStat(col('averageScore.overallRating'), row(), tr)).toBe('—')
  })

  it('formats rates, scores, hours and dates', () => {
    const r = row({
      stats: {
        attendanceRate: 0.666,
        averageScores: { overallRating: 4.25 } as BuddyStats['averageScores'],
        minutesOnTour: 150,
        lastTourDate: '2026-06-10',
      },
    })
    expect(formatStat(col('attendanceRate'), r, tr)).toBe('67%')
    expect(formatStat(col('averageScore.overallRating'), r, tr)).toBe('4.3')
    expect(formatStat(col('hoursOnTour'), r, tr)).toBe('2.5')
    expect(formatStat(col('lastTourDate'), r, tr)).toBe('2026/06/10')
  })

  it('reads profile enums through their labels', () => {
    const r = row({ memberType: 'plab_member' })
    expect(formatStat(col('status'), r, tr)).toBe('buddyStatus.active')
    expect(formatStat(col('tier'), r, tr)).toBe('buddyTier.buddy')
    expect(formatStat(col('memberType'), r, tr)).toBe('adminBuddies.memberTypePlabMember')
  })
})

describe('statLabel', () => {
  it('names a column by its key, filling in the value it is about', () => {
    expect(statLabel(col('noShows').label, tr, 'en')).toBe('adminBuddyStats.columns.noShows')
    expect(statLabel(col('averageScore.reliability').label, tr, 'en'))
      .toBe('adminBuddyStats.columns.averageScore(adminEvaluations.fields.reliability)')
    expect(statLabel(col('cancellations.health').label, tr, 'en'))
      .toBe('adminBuddyStats.columns.cancellationsByCategory(adminBuddies.cancelCategory.health)')
    expect(statLabel(col('groupType.school').label, tr, 'en'))
      .toBe('adminBuddyStats.columns.sessionsForGroupType(groupType.school)')
    expect(statLabel(col('place.p1').label, tr, 'ja')).toBe('adminBuddyStats.columns.sessionsAtPlace(ホール)')
  })
})

describe('statDescription', () => {
  it('describes only the columns whose name needs explaining', () => {
    expect(statDescription('attendanceRate', tr)).toBe('adminBuddyStats.descriptions.attendanceRate')
    expect(statDescription(col('averageScore.reliability').label.key, tr)).toBe('adminBuddyStats.descriptions.averageScore')
    expect(statDescription('noShows', tr)).toBeNull()
  })
})

describe('visible column storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('falls back to the default when nothing is saved', () => {
    expect(loadVisibleColumns(['a'])).toEqual(['a'])
  })

  it('reads back what was saved', () => {
    saveVisibleColumns(['noShows', 'tier'])
    expect(loadVisibleColumns(['a'])).toEqual(['noShows', 'tier'])
  })

  it('ignores a saved value that is not a list of ids', () => {
    window.localStorage.setItem('adminBuddyStats.columns', '{"x":1}')
    expect(loadVisibleColumns(['a'])).toEqual(['a'])
  })

  it('falls back when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadVisibleColumns(['a'])).toEqual(['a'])
    spy.mockRestore()
  })
})

describe('fetchBuddyStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends only the scope fields that are set', async () => {
    vi.mocked(apiClient.listBuddyStats).mockResolvedValue({ places: [], buddies: [] })

    const result = await fetchBuddyStats({ ...emptyBuddyStatsScope, from: '2026-04-01', groupType: 'school' })

    expect(result).toEqual({ ok: true, data: { places: [], buddies: [] } })
    expect(apiClient.listBuddyStats).toHaveBeenCalledWith({
      from: '2026-04-01',
      to: undefined,
      groupType: 'school',
      placeId: undefined,
    })
  })
})
