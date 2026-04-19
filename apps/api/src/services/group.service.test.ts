/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { listGroups, createGroup, updateGroup, getGroup } from './group.service'

vi.mock('../lib/db', () => ({
  db: {
    group: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindMany = vi.mocked(db.group).findMany
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockCreate = vi.mocked(db.group).create
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockUpdate = vi.mocked(db.group).update
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindUnique = vi.mocked(db.group).findUnique

const mockRaw = {
  id: 'group-1',
  name: 'Test School',
  type: 'school',
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  notes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('listGroups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns groups', async () => {
    mockFindMany.mockResolvedValueOnce([mockRaw] as any)
    const result = await listGroups()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('group-1')
  })

  it('orders by name asc', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    await listGroups()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    )
  })
})

describe('createGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns a group', async () => {
    mockCreate.mockResolvedValueOnce(mockRaw as any)
    const result = await createGroup({ name: 'Test School', type: 'school' })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Test School', type: 'school' } })
    )
    expect(result.id).toBe('group-1')
  })
})

describe('updateGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns updated group', async () => {
    const updated = { ...mockRaw, name: 'Renamed' }
    mockUpdate.mockResolvedValueOnce(updated as any)
    const result = await updateGroup('group-1', { name: 'Renamed' })
    expect(result?.name).toBe('Renamed')
  })

  it('returns null on P2025', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockUpdate.mockRejectedValueOnce(err)
    const result = await updateGroup('group-1', { name: 'X' })
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateGroup('group-1', { name: 'X' })).rejects.toThrow('db failure')
  })
})

describe('getGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns group with tours', async () => {
    mockFindUnique.mockResolvedValueOnce({ ...mockRaw, tours: [] } as any)
    const result = await getGroup('group-1')
    expect(result?.id).toBe('group-1')
    expect(result?.tours).toEqual([])
  })

  it('orders tours by tourDate desc', async () => {
    mockFindUnique.mockResolvedValueOnce({ ...mockRaw, tours: [] } as any)
    await getGroup('group-1')
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          tours: expect.objectContaining({ orderBy: { tourDate: 'desc' } }),
        }),
      })
    )
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const result = await getGroup('missing')
    expect(result).toBeNull()
  })
})
