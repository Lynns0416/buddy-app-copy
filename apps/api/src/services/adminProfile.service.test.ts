import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('../lib/db', () => ({
  db: {
    adminProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tourAdminAssignment: {
      findFirst: vi.fn(),
    },
  },
}))

import {
  getAdminProfile,
  listAdminProfiles,
  createAdminProfile,
  updateAdminProfile,
  softDeleteAdminProfile,
  HasActiveTourAssignmentsError,
} from './adminProfile.service'
import { db } from '../lib/db'

type StubAdmin = {
  id: string
  userId: string
  name: string
  deletedAt: Date | null
  createdAt: Date
}

const getDb = () => {
  const typedDb = db as unknown as {
    adminProfile: {
      findUnique: ReturnType<typeof vi.fn>
      findMany: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
    }
    tourAdminAssignment: {
      findFirst: ReturnType<typeof vi.fn>
    }
  }
  return typedDb
}

const stubAdminProfile: StubAdmin = {
  id: 'ap1',
  userId: 'u1',
  name: 'John Admin',
  deletedAt: null,
  createdAt: new Date('2026-01-15T00:00:00Z'),
}

describe('adminProfile.service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getAdminProfile', () => {
    it('returns admin profile by userId', async () => {
      getDb().adminProfile.findUnique.mockResolvedValue(stubAdminProfile)
      const result: unknown = await getAdminProfile('u1')
      expect(result).toEqual({
        id: 'ap1',
        userId: 'u1',
        name: 'John Admin',
        createdAt: '2026-01-15T00:00:00.000Z',
      })
      expect(getDb().adminProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: expect.any(Object) as unknown,
      })
    })

    it('returns null if profile not found', async () => {
      getDb().adminProfile.findUnique.mockResolvedValue(null)
      const result: unknown = await getAdminProfile('u1')
      expect(result).toBeNull()
    })

    it('returns null if profile is soft-deleted', async () => {
      getDb().adminProfile.findUnique.mockResolvedValue({
        id: 'ap1',
        userId: 'u1',
        name: 'John Admin',
        deletedAt: new Date('2026-02-15T00:00:00Z'),
        createdAt: new Date('2026-01-15T00:00:00Z'),
      })
      const result: unknown = await getAdminProfile('u1')
      expect(result).toBeNull()
    })
  })

  describe('listAdminProfiles', () => {
    it('lists all active admin profiles', async () => {
      getDb().adminProfile.findMany.mockResolvedValue([stubAdminProfile])
      const result: unknown = await listAdminProfiles()
      expect(result).toHaveLength(1)
      const arr = result as StubAdmin[]
      expect(arr[0]).toHaveProperty('name', 'John Admin')
      expect(getDb().adminProfile.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        select: expect.any(Object) as unknown,
        orderBy: { createdAt: 'asc' },
      })
    })

    it('returns empty array if no profiles', async () => {
      getDb().adminProfile.findMany.mockResolvedValue([])
      const result: unknown = await listAdminProfiles()
      expect(result).toEqual([])
    })
  })

  describe('createAdminProfile', () => {
    it('creates new admin profile', async () => {
      getDb().adminProfile.create.mockResolvedValue(stubAdminProfile)
      const result: unknown = await createAdminProfile('u1', 'John Admin')
      expect(result).toEqual({
        id: 'ap1',
        userId: 'u1',
        name: 'John Admin',
        createdAt: '2026-01-15T00:00:00.000Z',
      })
      expect(getDb().adminProfile.create).toHaveBeenCalledWith({
        data: { userId: 'u1', name: 'John Admin' },
        select: expect.any(Object) as unknown,
      })
    })

    it('returns null on duplicate userId (P2002)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      })
      getDb().adminProfile.create.mockRejectedValue(error)
      const result: unknown = await createAdminProfile('u1', 'John Admin')
      expect(result).toBeNull()
    })

    it('throws on other errors', async () => {
      getDb().adminProfile.create.mockRejectedValue(new Error('Network error'))
      await expect(createAdminProfile('u1', 'John Admin')).rejects.toThrow('Network error')
    })
  })

  describe('updateAdminProfile', () => {
    it('updates admin profile name', async () => {
      getDb().adminProfile.update.mockResolvedValue(stubAdminProfile)
      const result: unknown = await updateAdminProfile('u1', 'John Admin Updated')
      expect(result).not.toBeNull()
      expect(getDb().adminProfile.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { name: 'John Admin Updated' },
        select: expect.any(Object) as unknown,
      })
    })

    it('returns null if profile not found (P2025)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      })
      getDb().adminProfile.update.mockRejectedValue(error)
      const result: unknown = await updateAdminProfile('u1', 'John Admin')
      expect(result).toBeNull()
    })
  })

  describe('softDeleteAdminProfile', () => {
    it('soft deletes admin profile by setting deletedAt', async () => {
      const deletedProfile = { ...stubAdminProfile }
      getDb().adminProfile.findUnique.mockResolvedValueOnce({ id: 'ap-1' })
      getDb().tourAdminAssignment.findFirst.mockResolvedValueOnce(null)
      getDb().adminProfile.update.mockResolvedValue(deletedProfile)
      const result: unknown = await softDeleteAdminProfile('u1')
      expect(result).not.toBeNull()
      expect(getDb().adminProfile.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { deletedAt: expect.any(Date) as unknown },
        select: expect.any(Object) as unknown,
      })
    })

    it('returns null if profile not found', async () => {
      getDb().adminProfile.findUnique.mockResolvedValueOnce(null)
      const result: unknown = await softDeleteAdminProfile('u1')
      expect(result).toBeNull()
    })

    it('throws HasActiveTourAssignmentsError when admin has active tour assignments', async () => {
      getDb().adminProfile.findUnique.mockResolvedValueOnce({ id: 'ap-1' })
      getDb().tourAdminAssignment.findFirst.mockResolvedValueOnce({ id: 'assign-1' })
      await expect(softDeleteAdminProfile('u1')).rejects.toThrow(HasActiveTourAssignmentsError)
    })
  })
})
