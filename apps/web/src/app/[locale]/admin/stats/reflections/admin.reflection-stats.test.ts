import { describe, it, expect, vi } from 'vitest'
import type {
  AdminReflectionStatsBuddy,
  AdminReflectionStatsPlace,
  AdminReflectionStatsRow,
  TourReflectionMomentResponse,
} from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({ apiClient: {} }))
vi.mock('@/lib/api', () => ({ ApiError: class extends Error {} }))

import {
  buildReflectionOverview,
  defaultReflectionStatsFilters,
  filterByBuddy,
  filterReflections,
  sortReflections,
  spotKey,
} from './admin.reflection-stats'

const PARK = { id: 'park', nameJa: '平和公園', nameEn: 'Peace Park' }
const MUSEUM = { id: 'museum', nameJa: '原爆資料館', nameEn: 'Atomic Bomb Museum' }

const places: AdminReflectionStatsPlace[] = [
  {
    ...PARK,
    active: true,
    spots: [
      { id: 'statue', nameJa: '平和祈念像', nameEn: 'Peace Statue', active: true },
      { id: 'fountain', nameJa: '平和の泉', nameEn: 'Fountain of Peace', active: true },
      { id: 'retired', nameJa: '旧スポット', nameEn: 'Old spot', active: false },
    ],
  },
  { ...MUSEUM, active: true, spots: [] },
]

function moment(spotId: string | null, description: string, placeNote: string | null = null): TourReflectionMomentResponse {
  return { id: `${spotId}-${description}`, position: 0, spotId, placeNote, description, spot: null }
}

function row(id: string, overrides: Partial<AdminReflectionStatsRow> = {}): AdminReflectionStatsRow {
  return {
    id,
    buddyId: `buddy-${id}`,
    buddyDisplayName: `Buddy ${id}`,
    buddyRealName: '',
    buddyMemberType: 'buddy',
    sessionId: `s-${id}`,
    sessionOrder: 1,
    sessionLabel: null,
    tourId: 't1',
    tourDate: '2026-06-01T00:00:00.000Z',
    didWell: null,
    couldImprove: null,
    notesForOthers: null,
    openQuestions: null,
    moments: [],
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    group: { name: 'Nagasaki High', type: 'school' },
    place: PARK,
    ...overrides,
  }
}

function buddy(id: string, sessionsAttended: number, overrides: Partial<AdminReflectionStatsBuddy> = {}): AdminReflectionStatsBuddy {
  return { id, displayName: `Buddy ${id}`, realName: '', memberType: 'buddy', sessionsAttended, ...overrides }
}

const filters = defaultReflectionStatsFilters

describe('filterReflections', () => {
  it('leaves PLAB members out unless included', () => {
    const rows = [row('a'), row('b', { buddyMemberType: 'plab_member' })]
    expect(filterReflections(rows, filters).map((r) => r.id)).toEqual(['a'])
    expect(filterReflections(rows, { ...filters, includePlabMembers: true })).toHaveLength(2)
  })

  it('searches every prompt and moment, ignoring case', () => {
    const rows = [
      row('a', { couldImprove: 'Spoke too FAST' }),
      row('b', { moments: [moment(null, 'A quiet group', 'Bench by the stairs')] }),
      row('c', { didWell: 'On time' }),
    ]
    expect(filterReflections(rows, { ...filters, text: 'fast' }).map((r) => r.id)).toEqual(['a'])
    expect(filterReflections(rows, { ...filters, text: 'bench' }).map((r) => r.id)).toEqual(['b'])
  })

  it('keeps reflections with an open question, or naming a spot', () => {
    const rows = [
      row('a', { openQuestions: 'How hot was the flash?' }),
      row('b', { openQuestions: '  ', moments: [moment('statue', 'x')] }),
      row('c', { moments: [moment(null, 'y')] }),
    ]
    expect(filterReflections(rows, { ...filters, openQuestionsOnly: true }).map((r) => r.id)).toEqual(['a'])
    expect(filterReflections(rows, { ...filters, spot: 'statue' }).map((r) => r.id)).toEqual(['b'])
    expect(filterReflections(rows, { ...filters, spot: spotKey('park', null) }).map((r) => r.id)).toEqual(['c'])
  })

  it('matches a buddy by display or real name', () => {
    const rows = [row('a', { buddyRealName: 'Yamada Aya' }), row('b')]
    expect(filterReflections(rows, { ...filters, buddy: 'yamada' }).map((r) => r.id)).toEqual(['a'])
  })
})

describe('buildReflectionOverview', () => {
  it('pools the rate over the buddy filters only', () => {
    const rows = [row('a', { moments: [moment('statue', 'x')] }), row('b')]
    const buddies = [buddy('a', 2), buddy('b', 2)]
    const shown = filterReflections(rows, { ...filters, spot: 'statue' })
    const overview = buildReflectionOverview(shown, places, filterByBuddy(rows, filters), filterByBuddy(buddies, filters))
    expect(overview.reflections).toBe(1)
    expect(overview.reflectionRate).toBe(0.5)
  })

  it('has no rate when no one attended', () => {
    expect(buildReflectionOverview([], places, [], []).reflectionRate).toBeNull()
  })

  it('counts moments per spot, with zero spots, and no-spot moments last', () => {
    const rows = [
      row('a', { moments: [moment('statue', 'x'), moment('statue', 'y'), moment(null, 'z', 'Stairs')] }),
      row('b', { moments: [moment('fountain', 'w')] }),
    ]
    const [park] = buildReflectionOverview(rows, places, rows, []).spots
    expect(park.place.id).toBe('park')
    // Largest first; the retired spot has no moments, so it is left out.
    expect(park.bars.map((b) => [b.id, b.value])).toEqual([['statue', 2], ['fountain', 1], [spotKey('park', null), 1]])
  })

  it('shows an active spot nobody wrote about as zero, a retired one only with moments', () => {
    const rows = [row('a', { moments: [moment('retired', 'x')] })]
    const [park] = buildReflectionOverview(rows, places, rows, []).spots
    expect(park.bars.map((b) => [b.id, b.value])).toEqual([['retired', 1], ['statue', 0], ['fountain', 0]])
  })

  it('counts moments under the session place, largest first', () => {
    const rows = [
      row('a', { moments: [moment('statue', 'x')] }),
      row('b', { place: MUSEUM, moments: [moment(null, 'y', '原爆資料館'), moment(null, 'z', '原爆資料館')] }),
    ]
    const overview = buildReflectionOverview(rows, places, rows, [])
    expect(overview.places.map((b) => [b.id, b.value])).toEqual([['museum', 2], ['park', 1]])
    expect(overview.moments).toBe(3)
    expect(overview.places[0].match(rows[1])).toBe(true)
  })

  it('buckets reflections by tour month, including empty months', () => {
    const rows = [
      row('a', { tourDate: '2026-04-30T00:00:00.000Z' }),
      row('b', { tourDate: '2026-06-01T00:00:00.000Z' }),
      row('c', { tourDate: '2026-06-20T00:00:00.000Z', buddyId: 'buddy-a' }),
    ]
    const overview = buildReflectionOverview(rows, places, rows, [])
    expect(overview.months.map((m) => [m.id, m.value])).toEqual([['2026-04', 1], ['2026-05', 0], ['2026-06', 2]])
    expect(overview.buddiesWrote).toBe(2)
  })
})

describe('sortReflections', () => {
  it('sorts by tour date, submission time breaking ties', () => {
    const rows = [
      row('a', { tourDate: '2026-06-01T00:00:00.000Z', createdAt: '2026-06-03T00:00:00.000Z' }),
      row('b', { tourDate: '2026-05-01T00:00:00.000Z' }),
      row('c', { tourDate: '2026-06-01T00:00:00.000Z', createdAt: '2026-06-02T00:00:00.000Z' }),
    ]
    expect(sortReflections(rows, 'tourDate', 'asc', 'en').map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortReflections(rows, 'tourDate', 'desc', 'en').map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('sorts by place name in the page language', () => {
    const rows = [row('a'), row('b', { place: MUSEUM })]
    expect(sortReflections(rows, 'place', 'asc', 'en').map((r) => r.id)).toEqual(['b', 'a'])
  })
})
