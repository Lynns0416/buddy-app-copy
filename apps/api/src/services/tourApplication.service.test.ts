import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getPoolCapacities,
  assignApplication,
  promoteFromWaitlist,
  getApplicationStatus,
  createApplication,
  cancelApplication,
} from './tourApplication.service'
import { db } from '../lib/db'

vi.mock('../lib/db', () => ({
  db: {
    tour: {
      findUnique: vi.fn(),
    },
    tierCapacity: {
      findMany: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

const getDb = () => {
  const typedDb = db as unknown as {
    tour: { findUnique: ReturnType<typeof vi.fn> }
    tierCapacity: { findMany: ReturnType<typeof vi.fn> }
    application: {
      findUnique: ReturnType<typeof vi.fn>
      findFirst: ReturnType<typeof vi.fn>
      count: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
    }
    booking: {
      create: ReturnType<typeof vi.fn>
      deleteMany: ReturnType<typeof vi.fn>
    }
  }
  return typedDb
}

describe('tourApplication.service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getPoolCapacities', () => {
    it('returns default capacities (20/30/50) when no TierCapacity rows exist', async () => {
      getDb().tour.findUnique.mockResolvedValue({ capacity: 10 })
      getDb().tierCapacity.findMany.mockResolvedValue([])

      const result = await getPoolCapacities('tour-1')

      expect(result.junior).toBe(2)      // 20% of 10
      expect(result.non_junior).toBe(3)  // 30% of 10
      expect(result.anyone).toBe(5)      // 50% of 10
    })

    it('returns custom capacities from TierCapacity rows', async () => {
      getDb().tour.findUnique.mockResolvedValue({ capacity: 10 })
      getDb().tierCapacity.findMany.mockResolvedValue([
        { pool: 'junior', percent: 30 },
        { pool: 'non_junior', percent: 40 },
        { pool: 'anyone', percent: 30 },
      ])

      const result = await getPoolCapacities('tour-1')

      expect(result.junior).toBe(3)
      expect(result.non_junior).toBe(4)
      expect(result.anyone).toBe(3)
    })

    it('throws when tour not found', async () => {
      getDb().tour.findUnique.mockResolvedValue(null)

      await expect(getPoolCapacities('tour-1')).rejects.toThrow('Tour tour-1 not found')
    })
  })

  describe('assignApplication', () => {
    beforeEach(() => {
      getDb().tour.findUnique.mockResolvedValue({ capacity: 10 })
      getDb().tierCapacity.findMany.mockResolvedValue([]) // use defaults: junior=2, non_junior=3, anyone=5
    })

    it('approves junior buddy via junior pool when capacity available', async () => {
      getDb().application.findUnique
        .mockResolvedValueOnce({ id: 'app-1', tourId: 'tour-1', buddyTier: 'junior' }) // assignApplication lookup
        .mockResolvedValueOnce({ buddyId: 'buddy-1' }) // buddyId lookup for booking
      getDb().application.count.mockResolvedValue(0) // junior pool has space
      getDb().booking.create.mockResolvedValue({})

      await assignApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'approved', approvedAt: expect.any(Date) as unknown },
      })
      expect(getDb().booking.create).toHaveBeenCalledWith({
        data: {
          applicationId: 'app-1',
          buddyId: 'buddy-1',
          tourId: 'tour-1',
          status: 'confirmed',
        },
      })
    })

    it('approves junior buddy via anyone pool when junior pool is full', async () => {
      getDb().application.findUnique
        .mockResolvedValueOnce({ id: 'app-1', tourId: 'tour-1', buddyTier: 'junior' })
        .mockResolvedValueOnce({ buddyId: 'buddy-1' })
      getDb().application.count
        .mockResolvedValueOnce(2)  // junior pool full (capacity=2)
        .mockResolvedValueOnce(3)  // anyone pool has space (count=3, capacity=5)
      getDb().booking.create.mockResolvedValue({})

      await assignApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'approved', approvedAt: expect.any(Date) as unknown },
      })
    })

    it('waitlists buddy when both primary pool and anyone pool are full', async () => {
      getDb().application.findUnique.mockResolvedValueOnce({
        id: 'app-1', tourId: 'tour-1', buddyTier: 'junior',
      })
      getDb().application.count
        .mockResolvedValueOnce(2)  // junior pool full
        .mockResolvedValueOnce(5)  // anyone pool full
      getDb().booking.create.mockResolvedValue({})

      await assignApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'waitlisted' },
      })
      expect(getDb().booking.create).not.toHaveBeenCalled()
    })

    it('approves non-junior buddy via non_junior pool', async () => {
      getDb().application.findUnique
        .mockResolvedValueOnce({ id: 'app-2', tourId: 'tour-1', buddyTier: 'senior' })
        .mockResolvedValueOnce({ buddyId: 'buddy-2' })
      getDb().application.count.mockResolvedValue(0) // non_junior pool has space
      getDb().booking.create.mockResolvedValue({})

      await assignApplication('app-2')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-2' },
        data: { status: 'approved', approvedAt: expect.any(Date) as unknown },
      })
    })

    it('throws when application not found', async () => {
      getDb().application.findUnique.mockResolvedValue(null)

      await expect(assignApplication('app-x')).rejects.toThrow('Application app-x not found')
    })
  })

  describe('getApplicationStatus', () => {
    it('returns application status', async () => {
      getDb().application.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'approved',
        createdAt: new Date('2026-05-03T00:00:00Z'),
        approvedAt: new Date('2026-05-03T01:00:00Z'),
      })

      const result = await getApplicationStatus('tour-1', 'buddy-1')

      expect(result).toMatchObject({ id: 'app-1', status: 'approved' })
    })

    it('returns null when not found', async () => {
      getDb().application.findUnique.mockResolvedValue(null)

      const result = await getApplicationStatus('tour-1', 'buddy-1')

      expect(result).toBeNull()
    })
  })

  describe('createApplication', () => {
    beforeEach(() => {
      getDb().tour.findUnique.mockResolvedValue({ capacity: 10, status: 'published' })
      getDb().tierCapacity.findMany.mockResolvedValue([])
    })

    it('creates new application and assigns it', async () => {
      getDb().application.findUnique
        .mockResolvedValueOnce(null)  // no existing application
        .mockResolvedValueOnce({ id: 'app-1', tourId: 'tour-1', buddyTier: 'junior' })  // assignApplication
        .mockResolvedValueOnce({ buddyId: 'buddy-1' })  // booking creation
      getDb().application.create.mockResolvedValue({ id: 'app-1' })
      getDb().application.count.mockResolvedValue(0)
      getDb().booking.create.mockResolvedValue({})

      const result = await createApplication('tour-1', 'buddy-1', 'junior')

      expect(result).toEqual({ ok: true, data: 'app-1' })
      expect(getDb().application.create).toHaveBeenCalledWith({
        data: { tourId: 'tour-1', buddyId: 'buddy-1', buddyTier: 'junior', status: 'pending' },
        select: { id: true },
      })
    })

    it('reuses rejected application row on re-apply', async () => {
      getDb().application.findUnique
        .mockResolvedValueOnce({ id: 'app-1', status: 'rejected' })  // existing rejected
        .mockResolvedValueOnce({ id: 'app-1', tourId: 'tour-1', buddyTier: 'junior' })  // assignApplication
        .mockResolvedValueOnce({ buddyId: 'buddy-1' })  // booking creation
      getDb().application.count.mockResolvedValue(0)
      getDb().booking.create.mockResolvedValue({})

      const result = await createApplication('tour-1', 'buddy-1', 'junior')

      expect(result).toEqual({ ok: true, data: 'app-1' })
      expect(getDb().application.create).not.toHaveBeenCalled()
      expect(getDb().application.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'app-1' }, data: expect.objectContaining({ status: 'pending' }) as unknown }),
      )
    })

    it('returns conflict when existing application is not rejected', async () => {
      getDb().application.findUnique.mockResolvedValueOnce({ id: 'app-1', status: 'waitlisted' })

      const result = await createApplication('tour-1', 'buddy-1', 'junior')

      expect(result).toEqual({ ok: false, code: 'conflict' })
    })
  })

  describe('cancelApplication', () => {
    it('rejects approved application, deletes booking, and promotes from waitlist', async () => {
      getDb().application.findUnique.mockResolvedValue({
        status: 'approved', tourId: 'tour-1', buddyTier: 'junior',
      })
      getDb().tour.findUnique.mockResolvedValue({ capacity: 10 })
      getDb().tierCapacity.findMany.mockResolvedValue([])
      getDb().booking.deleteMany.mockResolvedValue({ count: 1 })
      getDb().application.count.mockResolvedValue(0)
      getDb().application.findFirst.mockResolvedValue(null)

      await cancelApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'rejected' },
      })
      expect(getDb().booking.deleteMany).toHaveBeenCalledWith({ where: { applicationId: 'app-1' } })
    })

    it('rejects waitlisted application without touching bookings', async () => {
      getDb().application.findUnique.mockResolvedValue({
        status: 'waitlisted', tourId: 'tour-1', buddyTier: 'junior',
      })

      await cancelApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'rejected' },
      })
      expect(getDb().booking.deleteMany).not.toHaveBeenCalled()
    })

    it('throws when application not found', async () => {
      getDb().application.findUnique.mockResolvedValue(null)

      await expect(cancelApplication('app-1')).rejects.toThrow('Application app-1 not found')
    })
  })

  describe('promoteFromWaitlist', () => {
    beforeEach(() => {
      getDb().tour.findUnique.mockResolvedValue({ capacity: 10 })
      getDb().tierCapacity.findMany.mockResolvedValue([])
    })

    it('promotes next waitlisted junior buddy when capacity available', async () => {
      getDb().application.findFirst.mockResolvedValueOnce({ id: 'app-2' })
      getDb().application.findUnique
        .mockResolvedValueOnce({ id: 'app-2', tourId: 'tour-1', buddyTier: 'junior' })
        .mockResolvedValueOnce({ buddyId: 'buddy-2' })
      getDb().application.count.mockResolvedValue(0)
      getDb().booking.create.mockResolvedValue({})

      await promoteFromWaitlist('tour-1', 'junior')

      expect(getDb().application.findFirst).toHaveBeenCalledWith({
        where: { tourId: 'tour-1', status: 'waitlisted', buddyTier: 'junior' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
    })

    it('falls back to any waitlisted buddy when no match in primary pool', async () => {
      getDb().application.findFirst
        .mockResolvedValueOnce(null)  // no waitlisted junior
        .mockResolvedValueOnce({ id: 'app-3' })  // any waitlisted buddy
      getDb().application.findUnique
        .mockResolvedValueOnce({ id: 'app-3', tourId: 'tour-1', buddyTier: 'senior' })
        .mockResolvedValueOnce({ buddyId: 'buddy-3' })
      getDb().application.count.mockResolvedValue(0)
      getDb().booking.create.mockResolvedValue({})

      await promoteFromWaitlist('tour-1', 'junior')

      expect(getDb().application.findFirst).toHaveBeenCalledTimes(2)
    })

    it('does nothing when no waitlisted buddies exist', async () => {
      getDb().application.findFirst.mockResolvedValue(null)

      await promoteFromWaitlist('tour-1', 'junior')

      expect(getDb().application.update).not.toHaveBeenCalled()
    })
  })
})
