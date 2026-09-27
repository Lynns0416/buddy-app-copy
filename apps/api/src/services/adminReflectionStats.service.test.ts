import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { AdminBuddyStatsRow } from '@peace-buddy/types'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  tourReflection: { findMany: MockFn }
  place: { findMany: MockFn }
}

vi.mock('../lib/db', () => ({
  db: {
    tourReflection: { findMany: vi.fn() },
    place: { findMany: vi.fn() },
  },
}))

// The real `tourWhere`, so the scope reads exactly as on the buddy stats page.
vi.mock('./adminBuddyStats.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./adminBuddyStats.service')>()),
  listBuddyStats: vi.fn(),
}))

import { db } from '../lib/db'
import { listBuddyStats } from './adminBuddyStats.service'
import { listReflectionStats } from './adminReflectionStats.service'

const mdb = db as unknown as MockDb
const mockBuddyStats = vi.mocked(listBuddyStats)

function whereOf(fn: MockFn): unknown {
  return (fn.mock.calls[0][0] as { where: unknown }).where
}

const NOW = new Date('2026-06-20T03:00:00Z')
const PEACE_PARK = { id: 'p1', nameJa: '平和公園', nameEn: 'Peace Park' }

const reflectionRow = {
  id: 'r1',
  buddyId: 'b1',
  sessionId: 's1',
  didWell: 'よく話を聞けた',
  couldImprove: null,
  notesForOthers: null,
  openQuestions: '被爆二世の支援制度について',
  createdAt: new Date('2026-06-02T09:00:00Z'),
  updatedAt: new Date('2026-06-02T09:00:00Z'),
  buddy: { displayName: 'Aya', realName: '山田 彩', memberType: 'buddy' },
  session: {
    tourId: 't1',
    order: 1,
    label: null,
    place: PEACE_PARK,
    tour: { tourDate: new Date('2026-06-01T00:00:00Z'), group: { name: '長崎高校', type: 'school' } },
  },
  moments: [],
}

function buddyStatsRow(id: string, sessionsAttended: number): AdminBuddyStatsRow {
  return {
    id,
    displayName: id,
    realName: '',
    status: 'active',
    tier: 'buddy',
    memberType: 'buddy',
    createdAt: '2026-01-01T00:00:00.000Z',
    stats: { sessionsAttended } as AdminBuddyStatsRow['stats'],
  }
}

describe('listReflectionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.tourReflection.findMany.mockResolvedValue([reflectionRow])
    mdb.place.findMany.mockResolvedValue([{ ...PEACE_PARK, active: true, spots: [] }])
    mockBuddyStats.mockResolvedValue({ places: [], buddies: [buddyStatsRow('b1', 3), buddyStatsRow('b2', 0)] })
  })

  it('adds the buddy, group and session place to each reflection', async () => {
    const [row] = (await listReflectionStats({}, NOW)).reflections
    expect(row).toMatchObject({
      id: 'r1',
      buddyDisplayName: 'Aya',
      buddyRealName: '山田 彩',
      buddyMemberType: 'buddy',
      group: { name: '長崎高校', type: 'school' },
      place: PEACE_PARK,
      tourDate: '2026-06-01T00:00:00.000Z',
      openQuestions: '被爆二世の支援制度について',
    })
  })

  it('scopes reflections by period, group type, place and tour', async () => {
    const from = new Date('2026-04-01T00:00:00Z')
    const to = new Date('2026-06-30T00:00:00Z')
    await listReflectionStats({ from, to, groupType: 'school', placeId: 'p1', tourId: 't1' }, NOW)
    expect(whereOf(mdb.tourReflection.findMany)).toEqual({
      session: {
        placeId: 'p1',
        tour: {
          id: 't1',
          status: { in: ['published', 'completed'] },
          tourDate: { gte: from, lte: to },
          group: { type: 'school' },
        },
      },
    })
  })

  it('counts sessions attended with the buddy stats, over the same scope', async () => {
    const scope = { placeId: 'p1', tourId: 't1' }
    const { buddies } = await listReflectionStats(scope, NOW)
    expect(mockBuddyStats).toHaveBeenCalledWith(scope, NOW)
    // A buddy with no session in scope has nothing to divide by.
    expect(buddies).toEqual([{ id: 'b1', displayName: 'b1', realName: '', memberType: 'buddy', sessionsAttended: 3 }])
  })

  it('returns every place with its spots, retired ones included', async () => {
    await listReflectionStats({}, NOW)
    const args = mdb.place.findMany.mock.calls[0][0] as { where?: unknown; select: { spots: { where?: unknown } } }
    expect(args.where).toBeUndefined()
    expect(args.select.spots.where).toBeUndefined()
  })
})
