import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listTours } from './tour.service'

vi.mock('../lib/db', () => ({
  db: {
    tour: {
      findMany: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

const mockFindMany = vi.mocked(db.tour.findMany)

const mockTour = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: new Date('2026-05-01'),
  meetingTime: new Date('2026-05-01T09:00:00'),
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

  it('returns tours', async () => {
    mockFindMany.mockResolvedValueOnce([mockTour] as any)
    const result = await listTours()
    expect(result).toEqual([mockTour])
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
