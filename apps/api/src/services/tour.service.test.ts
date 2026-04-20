/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listTours, getTour } from './tour.service'

vi.mock('../lib/db', () => ({
  db: {
    tour: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    booking: {
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindMany = vi.mocked(db.tour).findMany
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindUnique = vi.mocked(db.tour).findUnique
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGroupBy = vi.mocked(db.booking).groupBy
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindFirst = vi.mocked(db.booking).findFirst

const mockRow = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: new Date('2026-05-01'),
  meetingTime: new Date('1970-01-01T09:00:00.000Z'),
  startTime: null,
  endTime: null,
  bookingOpen: true,
  location: 'Tokyo Station',
  capacity: 10,
  description: null,
  cancellationDeadline: new Date('2026-04-28'),
  maybeDeadline: null,
  notificationOffsets: [7, 3],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('listTours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps all date fields to ISO strings', async () => {
    mockFindMany.mockResolvedValueOnce([mockRow] as any)
    const result = await listTours()
    expect(result).toHaveLength(1)
    const t = result[0]
    expect(typeof t.tourDate).toBe('string')
    expect(typeof t.meetingTime).toBe('string')
    expect(typeof t.cancellationDeadline).toBe('string')
    expect(typeof t.createdAt).toBe('string')
    expect(typeof t.updatedAt).toBe('string')
  })

  it('passes through startTime, endTime, and bookingOpen', async () => {
    mockFindMany.mockResolvedValueOnce([mockRow] as any)
    const result = await listTours()
    expect(result[0].startTime).toBeNull()
    expect(result[0].endTime).toBeNull()
    expect(result[0].bookingOpen).toBe(true)
  })

  it('maps non-null startTime and endTime to ISO strings', async () => {
    const rowWithTimes = {
      ...mockRow,
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T11:00:00.000Z'),
    }
    mockFindMany.mockResolvedValueOnce([rowWithTimes] as any)
    const result = await listTours()
    expect(typeof result[0].startTime).toBe('string')
    expect(typeof result[0].endTime).toBe('string')
  })

  it('defaults to published status when no filters given', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    await listTours()
    const call = mockFindMany.mock.calls[0][0] as any
    expect(call.where.status).toBe('published')
  })

  it('uses provided status filter', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    await listTours({ status: 'completed' })
    const call = mockFindMany.mock.calls[0][0] as any
    expect(call.where.status).toBe('completed')
  })

  it('applies from/to date filters on tourDate', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    const from = new Date('2026-05-01')
    const to = new Date('2026-05-31')
    await listTours({ from, to })
    const call = mockFindMany.mock.calls[0][0] as any
    expect(call.where.tourDate).toEqual({ gte: from, lte: to })
  })

  it('applies only from when to is not provided', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    const from = new Date('2026-05-01')
    await listTours({ from })
    const call = mockFindMany.mock.calls[0][0] as any
    expect(call.where.tourDate).toEqual({ gte: from })
  })

  it('orders by tourDate ascending', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    await listTours()
    const call = mockFindMany.mock.calls[0][0] as any
    expect(call.orderBy).toEqual({ tourDate: 'asc' })
  })

  it('does not include adminMemo in the select', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    await listTours()
    const call = mockFindMany.mock.calls[0][0] as any
    expect(call.select.adminMemo).toBeUndefined()
  })
})

describe('getTour', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when tour not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null as any)
    mockGroupBy.mockResolvedValueOnce([] as any)
    mockFindFirst.mockResolvedValueOnce(null as any)
    const result = await getTour('nonexistent', 'user-1')
    expect(result).toBeNull()
  })

  it('returns tour detail with seat counts and myBookingStatus', async () => {
    mockFindUnique.mockResolvedValueOnce(mockRow as any)
    mockGroupBy.mockResolvedValueOnce([
      { status: 'confirmed', _count: { status: 3 } },
      { status: 'maybe', _count: { status: 1 } },
    ] as any)
    mockFindFirst.mockResolvedValueOnce({ status: 'confirmed' } as any)

    const result = await getTour('tour-1', 'user-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('tour-1')
    expect(result!.seatCounts).toEqual({ confirmed: 3, maybe: 1, waitlist: 0, declined: 0 })
    expect(result!.remainingSeats).toBe(7)
    expect(result!.myBookingStatus).toBe('confirmed')
  })

  it('returns myBookingStatus null when buddy has no booking', async () => {
    mockFindUnique.mockResolvedValueOnce(mockRow as any)
    mockGroupBy.mockResolvedValueOnce([] as any)
    mockFindFirst.mockResolvedValueOnce(null as any)

    const result = await getTour('tour-1', 'user-1')
    expect(result!.myBookingStatus).toBeNull()
    expect(result!.seatCounts).toEqual({ confirmed: 0, maybe: 0, waitlist: 0, declined: 0 })
    expect(result!.remainingSeats).toBe(10)
  })

  it('does not include adminMemo in select', async () => {
    mockFindUnique.mockResolvedValueOnce(null as any)
    mockGroupBy.mockResolvedValueOnce([] as any)
    mockFindFirst.mockResolvedValueOnce(null as any)
    await getTour('tour-1', 'user-1')
    const call = mockFindUnique.mock.calls[0][0] as any
    expect(call.select.adminMemo).toBeUndefined()
  })

  it('passes userId to booking findFirst for myBookingStatus lookup', async () => {
    mockFindUnique.mockResolvedValueOnce(mockRow as any)
    mockGroupBy.mockResolvedValueOnce([] as any)
    mockFindFirst.mockResolvedValueOnce(null as any)
    await getTour('tour-1', 'user-42')
    const call = mockFindFirst.mock.calls[0][0] as any
    expect(call.where.buddy.userId).toBe('user-42')
  })
})
