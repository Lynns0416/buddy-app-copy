import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTierCapacities,
  assignApplication,
  promoteFromWaitlist,
  getApplicationStatus,
  createApplication,
  cancelApplication,
  getApprovedCount,
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
    buddyProfile: {
      findUnique: vi.fn(),
    },
  },
}))

const getDb = () => {
  const typedDb = db as unknown as {
    tour: {
      findUnique: ReturnType<typeof vi.fn>
    }
    tierCapacity: {
      findMany: ReturnType<typeof vi.fn>
    }
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
    buddyProfile: {
      findUnique: ReturnType<typeof vi.fn>
    }
  }
  return typedDb
}

describe('tourApplication.service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getTierCapacities', () => {
    it('returns all zero capacity when mentorshipBalanced is false', async () => {
      getDb().tour.findUnique.mockResolvedValue({
        capacity: 10,
        mentorshipBalanced: false,
      })

      const result = await getTierCapacities('tour-1')

      expect(result.junior).toBe(0)
      expect(result.senior).toBe(0)
    })

    it('loads tier capacities from config when mentorshipBalanced is true', async () => {
      getDb().tour.findUnique.mockResolvedValue({
        capacity: 10,
        mentorshipBalanced: true,
      })
      getDb().tierCapacity.findMany.mockResolvedValue([
        { tier: 'junior', percent: 20 },
        { tier: 'senior', percent: 30 },
      ])

      const result = await getTierCapacities('tour-1')

      expect(result.junior).toBe(2)
      expect(result.senior).toBe(3)
      expect(getDb().tierCapacity.findMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        select: { tier: true, percent: true },
      })
    })

    it('throws when tour not found', async () => {
      getDb().tour.findUnique.mockResolvedValue(null)

      await expect(getTierCapacities('tour-1')).rejects.toThrow('Tour tour-1 not found')
    })
  })

  describe('getApprovedCount', () => {
    it('counts approved applications for a tour', async () => {
      getDb().application.count.mockResolvedValue(3)

      const result = await getApprovedCount('tour-1')

      expect(result).toBe(3)
      expect(getDb().application.count).toHaveBeenCalledWith({
        where: {
          tourId: 'tour-1',
          status: 'approved',
        },
      })
    })

    it('counts approved applications by tier', async () => {
      getDb().application.count.mockResolvedValue(1)

      const result = await getApprovedCount('tour-1', 'junior')

      expect(result).toBe(1)
      expect(getDb().application.count).toHaveBeenCalledWith({
        where: {
          tourId: 'tour-1',
          status: 'approved',
          buddyTier: 'junior',
        },
      })
    })
  })

  describe('assignApplication', () => {
    beforeEach(() => {
      getDb().tour.findUnique.mockResolvedValue({
        capacity: 10,
        mentorshipBalanced: true,
      })
      getDb().tierCapacity.findMany.mockResolvedValue([
        { tier: 'junior', percent: 20 },
        { tier: 'senior', percent: 30 },
      ])
    })

    it('approves junior application when junior capacity available', async () => {
      getDb().application.findUnique.mockResolvedValue({
        id: 'app-1',
        tourId: 'tour-1',
        buddyId: 'buddy-1',
        buddyTier: 'junior',
      })
      getDb().application.count.mockResolvedValue(0)
      getDb().booking.create.mockResolvedValue({ id: 'booking-1' })

      await assignApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          status: 'approved',
          approvedAt: expect.any(Date) as unknown,
        },
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

    it('waitlists when tier capacity full', async () => {
      getDb().application.findUnique.mockResolvedValue({
        id: 'app-1',
        tourId: 'tour-1',
        buddyId: 'buddy-1',
        buddyTier: 'junior',
      })
      getDb().application.count.mockResolvedValue(2)

      await assignApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          status: 'waitlisted',
        },
      })
      expect(getDb().booking.create).not.toHaveBeenCalled()
    })
  })

  describe('promoteFromWaitlist', () => {
    beforeEach(() => {
      getDb().tour.findUnique.mockResolvedValue({
        capacity: 10,
        mentorshipBalanced: true,
      })
      getDb().tierCapacity.findMany.mockResolvedValue([
        { tier: 'junior', percent: 20 },
        { tier: 'senior', percent: 30 },
      ])
    })

    it('promotes next waitlisted buddy when tier has capacity', async () => {
      getDb().application.count.mockResolvedValue(0)
      getDb().application.findFirst.mockResolvedValue({
        id: 'app-2',
      })
      getDb().application.findUnique.mockResolvedValue({
        id: 'app-2',
        tourId: 'tour-1',
        buddyId: 'buddy-2',
        buddyTier: 'junior',
      })
      getDb().booking.create.mockResolvedValue({})

      const result = await promoteFromWaitlist('tour-1', 'junior')

      expect(result).toBe(true)
      expect(getDb().application.findFirst).toHaveBeenCalledWith({
        where: {
          tourId: 'tour-1',
          status: 'waitlisted',
          buddyTier: 'junior',
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
    })

    it('returns false when tier capacity full', async () => {
      getDb().application.count.mockResolvedValue(2)

      const result = await promoteFromWaitlist('tour-1', 'junior')

      expect(result).toBe(false)
      expect(getDb().application.findFirst).not.toHaveBeenCalled()
    })

    it('returns false when no waitlisted buddies', async () => {
      getDb().application.count.mockResolvedValue(0)
      getDb().application.findFirst.mockResolvedValue(null)

      const result = await promoteFromWaitlist('tour-1', 'junior')

      expect(result).toBe(false)
    })
  })

  describe('getApplicationStatus', () => {
    it('returns application status by tourId and buddyId', async () => {
      getDb().application.findUnique.mockResolvedValue({
        id: 'app-1',
        status: 'approved',
        createdAt: new Date('2026-05-03T00:00:00Z'),
        approvedAt: new Date('2026-05-03T01:00:00Z'),
      })

      const result = await getApplicationStatus('tour-1', 'buddy-1')

      expect(result).toEqual({
        id: 'app-1',
        status: 'approved',
        createdAt: expect.any(Date) as unknown,
        approvedAt: expect.any(Date) as unknown,
      })
    })

    it('returns null when application not found', async () => {
      getDb().application.findUnique.mockResolvedValue(null)

      const result = await getApplicationStatus('tour-1', 'buddy-1')

      expect(result).toBeNull()
    })
  })

  describe('createApplication', () => {
    beforeEach(() => {
      getDb().tour.findUnique.mockResolvedValue({
        capacity: 10,
        mentorshipBalanced: true,
      })
      getDb().tierCapacity.findMany.mockResolvedValue([
        { tier: 'junior', percent: 20 },
      ])
    })

    it('creates application and assigns it', async () => {
      getDb().application.create.mockResolvedValue({ id: 'app-1' })
      getDb().application.findUnique.mockResolvedValue({
        id: 'app-1',
        tourId: 'tour-1',
        buddyId: 'buddy-1',
        buddyTier: 'junior',
      })
      getDb().application.count.mockResolvedValue(0)
      getDb().booking.create.mockResolvedValue({})

      const result = await createApplication('tour-1', 'buddy-1', 'junior')

      expect(result).toBe('app-1')
      expect(getDb().application.create).toHaveBeenCalledWith({
        data: {
          tourId: 'tour-1',
          buddyId: 'buddy-1',
          buddyTier: 'junior',
          status: 'pending',
        },
        select: { id: true },
      })
    })
  })

  describe('cancelApplication', () => {
    it('rejects approved application and deletes booking', async () => {
      getDb().application.findUnique.mockResolvedValue({
        status: 'approved',
        tourId: 'tour-1',
        buddyId: 'buddy-1',
        buddyTier: 'junior',
      })
      getDb().tour.findUnique.mockResolvedValue({
        capacity: 10,
        mentorshipBalanced: true,
      })
      getDb().tierCapacity.findMany.mockResolvedValue([
        { tier: 'junior', percent: 20 },
      ])
      getDb().booking.deleteMany.mockResolvedValue({ count: 1 })
      getDb().application.count.mockResolvedValue(0)
      getDb().application.findFirst.mockResolvedValue(null)

      await cancelApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          status: 'rejected',
        },
      })
      expect(getDb().booking.deleteMany).toHaveBeenCalledWith({
        where: {
          applicationId: 'app-1',
        },
      })
    })

    it('rejects pending application without deleting booking', async () => {
      getDb().application.findUnique.mockResolvedValue({
        status: 'pending',
        tourId: 'tour-1',
        buddyId: 'buddy-1',
        buddyTier: 'junior',
      })

      await cancelApplication('app-1')

      expect(getDb().application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          status: 'rejected',
        },
      })
      expect(getDb().booking.deleteMany).not.toHaveBeenCalled()
    })

    it('throws when application not found', async () => {
      getDb().application.findUnique.mockResolvedValue(null)

      await expect(cancelApplication('app-1')).rejects.toThrow('Application app-1 not found')
    })
  })
})
