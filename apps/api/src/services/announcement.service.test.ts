import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import type { TourDetailResponse, TourSessionDetailResponse, UpsertAnnouncement } from '@peace-buddy/types'

type MockFn = Mock<(...args: unknown[]) => unknown>

interface MockDb {
  announcement: {
    findMany: MockFn
    findUnique: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
    aggregate: MockFn
  }
  announcementRecipient: { deleteMany: MockFn }
  buddyProfile: { findUnique: MockFn; count: MockFn }
  adminProfile: { findUniqueOrThrow: MockFn }
  tour: { findUnique: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    announcement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    announcementRecipient: { deleteMany: vi.fn() },
    buddyProfile: { findUnique: vi.fn(), count: vi.fn() },
    adminProfile: { findUniqueOrThrow: vi.fn() },
    tour: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  }
  return { db: mockDb }
})

vi.mock('./tour.service', () => ({ getTour: vi.fn() }))

import { db } from '../lib/db'
import { getTour } from './tour.service'
import {
  countAudience,
  createAnnouncement,
  listMyAnnouncements,
  reorderAnnouncements,
  updateAnnouncement,
  AnnouncementNotFoundError,
  AnnouncementOrderMismatchError,
  AnnouncementReferenceError,
} from './announcement.service'

const mdb = db as unknown as MockDb
const mockGetTour = getTour as unknown as MockFn

const BUDDY_ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890'

function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ann-1',
    titleJa: 'お知らせ',
    bodyJa: '本文',
    titleEn: null,
    bodyEn: null,
    audience: 'rule',
    statuses: [],
    tiers: [],
    startDate: new Date('2026-10-01T00:00:00.000Z'),
    endDate: new Date('2026-10-10T00:00:00.000Z'),
    position: 0,
    createdAt: new Date('2026-09-30T00:00:00.000Z'),
    updatedAt: new Date('2026-09-30T00:00:00.000Z'),
    tour: null,
    createdBy: { name: 'Admin' },
    updatedBy: { name: 'Admin' },
    recipients: [],
    ...overrides,
  }
}

function makeInput(overrides: Partial<UpsertAnnouncement> = {}): UpsertAnnouncement {
  return {
    titleJa: 'お知らせ',
    bodyJa: '本文',
    titleEn: null,
    bodyEn: null,
    audience: 'rule',
    statuses: ['active'],
    tiers: ['star'],
    buddyIds: [],
    startDate: '2026-10-01',
    endDate: '2026-10-10',
    tourId: null,
    ...overrides,
  }
}

function makeSession(overrides: Partial<TourSessionDetailResponse> = {}): TourSessionDetailResponse {
  return {
    id: 's1',
    order: 1,
    label: null,
    meetingTime: '1970-01-01T09:00:00.000Z',
    startTime: null,
    endTime: null,
    capacity: 10,
    minBuddies: 5,
    participantCount: 40,
    place: { id: 'p1', nameJa: '平和公園', nameEn: 'Peace Park', spots: [] },
    seatCounts: { confirmed: 2, maybe: 0, waitlist: 0, declined: 0 },
    remaining: 8,
    myCapacity: 6,
    myRemaining: 4,
    myBookingStatus: null,
    ...overrides,
  }
}

function makeTour(overrides: Partial<TourDetailResponse> = {}): TourDetailResponse {
  return {
    id: 'tour-1',
    groupId: 'g1',
    group: { id: 'g1', name: 'School', type: 'school' },
    status: 'published',
    tourDate: '2026-10-20T00:00:00.000Z',
    bookingOpen: true,
    places: [],
    participantCount: 40,
    description: null,
    cancellationDeadline: '2026-10-15T00:00:00.000Z',
    maybeDeadline: null,
    notificationOffsets: [],
    sessions: [makeSession()],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    staffInCharge: null,
    ...overrides,
  }
}

const shown = { id: 'ann-1', titleJa: 't', bodyJa: 'b', titleEn: null, bodyEn: null, tourId: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  // 2026-10-05 in JST
  vi.setSystemTime(new Date('2026-10-05T03:00:00.000Z'))
  mdb.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: MockDb) => unknown)(mdb) : Promise.all(arg as unknown[]),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('countAudience', () => {
  it('counts trainee and active buddies when the rule is empty', async () => {
    mdb.buddyProfile.count.mockResolvedValueOnce(7)

    expect(await countAudience({ audience: 'rule', statuses: [], tiers: [], buddyIds: [] })).toBe(7)
    expect(mdb.buddyProfile.count).toHaveBeenCalledWith({ where: { status: { in: ['trainee', 'active'] } } })
  })

  it('ANDs statuses with tiers', async () => {
    mdb.buddyProfile.count.mockResolvedValueOnce(2)

    await countAudience({ audience: 'rule', statuses: ['active'], tiers: ['star'], buddyIds: [] })

    expect(mdb.buddyProfile.count).toHaveBeenCalledWith({ where: { status: { in: ['active'] }, tier: { in: ['star'] } } })
  })

  it('counts picked buddies who still reach Home', async () => {
    mdb.buddyProfile.count.mockResolvedValueOnce(1)

    await countAudience({ audience: 'selected', statuses: [], tiers: [], buddyIds: [BUDDY_ID] })

    expect(mdb.buddyProfile.count).toHaveBeenCalledWith({
      where: { id: { in: [BUDDY_ID] }, status: { in: ['trainee', 'active'] } },
    })
  })
})

describe('createAnnouncement', () => {
  it('puts a new announcement above the current top', async () => {
    mdb.adminProfile.findUniqueOrThrow.mockResolvedValueOnce({ id: 'ap-1' })
    mdb.announcement.aggregate.mockResolvedValueOnce({ _min: { position: 2 } })
    mdb.announcement.create.mockResolvedValueOnce(makeAdminRow())

    await createAnnouncement(makeInput(), 'user-1')

    const { data } = mdb.announcement.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data).toMatchObject({ position: 1, createdById: 'ap-1', updatedById: 'ap-1' })
    expect(data.startDate).toEqual(new Date('2026-10-01T00:00:00.000Z'))
  })

  it('keeps no picked buddies on a rule, and no rule on picked buddies', async () => {
    mdb.adminProfile.findUniqueOrThrow.mockResolvedValue({ id: 'ap-1' })
    mdb.announcement.aggregate.mockResolvedValue({ _min: { position: null } })
    mdb.announcement.create.mockResolvedValue(makeAdminRow())
    mdb.buddyProfile.count.mockResolvedValueOnce(1)

    await createAnnouncement(makeInput({ buddyIds: [BUDDY_ID] }), 'user-1')
    await createAnnouncement(makeInput({ audience: 'selected', buddyIds: [BUDDY_ID] }), 'user-1')

    const rule = (mdb.announcement.create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    const selected = (mdb.announcement.create.mock.calls[1][0] as { data: Record<string, unknown> }).data
    expect(rule).toMatchObject({ statuses: ['active'], tiers: ['star'], recipients: { create: [] } })
    expect(selected).toMatchObject({ statuses: [], tiers: [], recipients: { create: [{ buddyId: BUDDY_ID }] } })
  })

  it('rejects a linked tour that does not exist', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)

    await expect(createAnnouncement(makeInput({ tourId: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890' }), 'user-1')).rejects.toThrow(
      AnnouncementReferenceError,
    )
    expect(mdb.announcement.create).not.toHaveBeenCalled()
  })

  it('rejects a picked buddy that does not exist', async () => {
    mdb.buddyProfile.count.mockResolvedValueOnce(0)

    await expect(createAnnouncement(makeInput({ audience: 'selected', buddyIds: [BUDDY_ID] }), 'user-1')).rejects.toThrow(
      AnnouncementReferenceError,
    )
  })
})

describe('updateAnnouncement', () => {
  it('throws when the announcement does not exist', async () => {
    mdb.announcement.findUnique.mockResolvedValueOnce(null)

    await expect(updateAnnouncement('missing', makeInput(), 'user-1')).rejects.toThrow(AnnouncementNotFoundError)
  })

  it('replaces the picked buddies and records the editor', async () => {
    mdb.announcement.findUnique.mockResolvedValueOnce({ id: 'ann-1' })
    mdb.buddyProfile.count.mockResolvedValueOnce(1)
    mdb.adminProfile.findUniqueOrThrow.mockResolvedValueOnce({ id: 'ap-2' })
    mdb.announcement.update.mockResolvedValueOnce(makeAdminRow())

    await updateAnnouncement('ann-1', makeInput({ audience: 'selected', buddyIds: [BUDDY_ID] }), 'user-2')

    expect(mdb.announcementRecipient.deleteMany).toHaveBeenCalledWith({ where: { announcementId: 'ann-1' } })
    const { data } = mdb.announcement.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data).toMatchObject({ updatedById: 'ap-2', recipients: { create: [{ buddyId: BUDDY_ID }] } })
    expect(data).not.toHaveProperty('createdById')
  })
})

describe('reorderAnnouncements', () => {
  it('writes each position from the order given', async () => {
    mdb.announcement.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce([])
    mdb.announcement.update.mockResolvedValue({})

    await reorderAnnouncements(['b', 'a'])

    expect(mdb.announcement.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { position: 0 } })
    expect(mdb.announcement.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { position: 1 } })
  })

  it.each([
    ['one missing', ['a']],
    ['one repeated', ['a', 'a']],
    ['one unknown', ['a', 'c']],
  ])('rejects ids with %s', async (_, ids) => {
    mdb.announcement.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])

    await expect(reorderAnnouncements(ids)).rejects.toThrow(AnnouncementOrderMismatchError)
    expect(mdb.announcement.update).not.toHaveBeenCalled()
  })
})

describe('listMyAnnouncements', () => {
  it('returns nothing to a buddy who does not reach Home', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ id: 'b1', status: 'pending', tier: null })

    expect(await listMyAnnouncements('user-1')).toEqual([])
    expect(mdb.announcement.findMany).not.toHaveBeenCalled()
  })

  it('matches today in JST, the buddy rule and the picked buddies', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ id: 'b1', status: 'active', tier: 'star' })
    mdb.announcement.findMany.mockResolvedValueOnce([])

    await listMyAnnouncements('user-1')

    const { where, select } = mdb.announcement.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>
      select: Record<string, unknown>
    }
    expect(where.startDate).toEqual({ lte: new Date('2026-10-05T00:00:00.000Z') })
    expect(where.endDate).toEqual({ gte: new Date('2026-10-05T00:00:00.000Z') })
    expect(where.OR).toEqual([
      {
        audience: 'rule',
        AND: [
          { OR: [{ statuses: { isEmpty: true } }, { statuses: { has: 'active' } }] },
          { OR: [{ tiers: { isEmpty: true } }, { tiers: { has: 'star' } }] },
        ],
      },
      { audience: 'selected', recipients: { some: { buddyId: 'b1' } } },
    ])
    // Nothing about who it was meant for reaches the buddy.
    expect(Object.keys(select).sort()).toEqual(['bodyEn', 'bodyJa', 'id', 'titleEn', 'titleJa', 'tourId'])
  })

  it('never matches a rule with tiers for a buddy without one', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ id: 'b1', status: 'trainee', tier: null })
    mdb.announcement.findMany.mockResolvedValueOnce([])

    await listMyAnnouncements('user-1')

    const { where } = mdb.announcement.findMany.mock.calls[0][0] as { where: { OR: Array<{ AND?: unknown[] }> } }
    expect(where.OR[0].AND![1]).toEqual({ tiers: { isEmpty: true } })
  })

  describe('a tour-linked announcement', () => {
    beforeEach(() => {
      mdb.buddyProfile.findUnique.mockResolvedValueOnce({ id: 'b1', status: 'active', tier: 'buddy' })
      mdb.announcement.findMany.mockResolvedValueOnce([shown, { ...shown, id: 'ann-2', tourId: 'tour-1' }])
    })

    const ids = async () => (await listMyAnnouncements('user-1')).map((a) => a.id)

    it('shows while a session is short and the buddy can take a seat', async () => {
      mockGetTour.mockResolvedValueOnce(makeTour())
      expect(await ids()).toEqual(['ann-1', 'ann-2'])
      expect(mockGetTour).toHaveBeenCalledWith('tour-1', 'user-1')
    })

    it('hides once every session has its minimum', async () => {
      mockGetTour.mockResolvedValueOnce(
        makeTour({
          sessions: [
            makeSession({ seatCounts: { confirmed: 5, maybe: 0, waitlist: 0, declined: 0 } }),
            makeSession({ id: 's2', minBuddies: 3, seatCounts: { confirmed: 4, maybe: 0, waitlist: 0, declined: 0 } }),
          ],
        }),
      )
      expect(await ids()).toEqual(['ann-1'])
    })

    it('stays while one of two sessions is still short', async () => {
      mockGetTour.mockResolvedValueOnce(
        makeTour({
          sessions: [makeSession({ seatCounts: { confirmed: 5, maybe: 0, waitlist: 0, declined: 0 } }), makeSession({ id: 's2' })],
        }),
      )
      expect(await ids()).toEqual(['ann-1', 'ann-2'])
    })

    it.each([
      ['cancelled', { status: 'cancelled' as const }],
      ['back to draft', { status: 'draft' as const }],
      ['dated before today', { tourDate: '2026-10-04T00:00:00.000Z' }],
      ['dated today', { tourDate: '2026-10-05T00:00:00.000Z' }],
      ['closed for booking', { bookingOpen: false }],
    ])('hides when the tour is %s', async (_, overrides) => {
      mockGetTour.mockResolvedValueOnce(makeTour(overrides))
      expect(await ids()).toEqual(['ann-1'])
    })

    it('hides when the tour is gone or hidden from the buddy', async () => {
      mockGetTour.mockResolvedValueOnce(null)
      expect(await ids()).toEqual(['ann-1'])
    })

    it.each(['confirmed', 'maybe', 'waitlist'] as const)('hides when the buddy already holds a %s booking', async (status) => {
      mockGetTour.mockResolvedValueOnce(makeTour({ sessions: [makeSession({ myBookingStatus: status })] }))
      expect(await ids()).toEqual(['ann-1'])
    })

    it('hides when the buddy tier pool has no seat left', async () => {
      mockGetTour.mockResolvedValueOnce(makeTour({ sessions: [makeSession({ myRemaining: 0 })] }))
      expect(await ids()).toEqual(['ann-1'])
    })
  })
})
