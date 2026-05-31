import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('../lib/db', () => ({
  db: {
    adminProfile: {
      findUnique: vi.fn(),
    },
    tour: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    tourAdminAssignment: {
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('./adminTour.service', () => ({
  getAdminTourDetail: vi.fn(),
}))

import {
  assignAdmin,
  unassignAdmin,
  setStaffInCharge,
  AssignAdminNotFoundError,
  AdminAlreadyAssignedError,
  AdminNotAssignedError,
  StaffInChargeNotAssignedError,
  StaffInChargeRequiresReplacementError,
  StaffInChargeRequiredError,
} from './tourAdminAssignment.service'
import { db } from '../lib/db'
import { getAdminTourDetail } from './adminTour.service'

type MockDb = {
  adminProfile: { findUnique: ReturnType<typeof vi.fn> }
  tour: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
  }
  tourAdminAssignment: {
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

const getDb = () => db as unknown as MockDb
const mockGetAdminTourDetail = vi.mocked(getAdminTourDetail)

const stubDetail = { id: 'tour-1', assignedAdmins: [], staffInChargeId: null } as never

beforeEach(() => {
  vi.resetAllMocks()
})

describe('assignAdmin', () => {
  it('creates assignment and returns updated tour detail', async () => {
    getDb().adminProfile.findUnique.mockResolvedValueOnce({ id: 'ap-1', deletedAt: null })
    getDb().tourAdminAssignment.create.mockResolvedValueOnce({})
    mockGetAdminTourDetail.mockResolvedValueOnce(stubDetail)

    const result = await assignAdmin('tour-1', 'ap-1')

    expect(getDb().tourAdminAssignment.create).toHaveBeenCalledWith({
      data: { tourId: 'tour-1', adminId: 'ap-1' },
    })
    expect(result).toBe(stubDetail)
  })

  it('throws AssignAdminNotFoundError when admin does not exist', async () => {
    getDb().adminProfile.findUnique.mockResolvedValueOnce(null)
    await expect(assignAdmin('tour-1', 'ap-1')).rejects.toThrow(AssignAdminNotFoundError)
  })

  it('throws AssignAdminNotFoundError when admin is soft-deleted', async () => {
    getDb().adminProfile.findUnique.mockResolvedValueOnce({
      id: 'ap-1',
      deletedAt: new Date('2026-01-01'),
    })
    await expect(assignAdmin('tour-1', 'ap-1')).rejects.toThrow(AssignAdminNotFoundError)
  })

  it('throws AdminAlreadyAssignedError on duplicate assignment (P2002)', async () => {
    getDb().adminProfile.findUnique.mockResolvedValueOnce({ id: 'ap-1', deletedAt: null })
    getDb().tourAdminAssignment.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    )
    await expect(assignAdmin('tour-1', 'ap-1')).rejects.toThrow(AdminAlreadyAssignedError)
  })
})

describe('unassignAdmin', () => {
  it('deletes assignment and returns updated tour detail', async () => {
    getDb().tour.findUnique.mockResolvedValueOnce({ staffInChargeId: 'other-ap' })
    getDb().tourAdminAssignment.count.mockResolvedValueOnce(1)
    getDb().$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        tour: { updateMany: vi.fn().mockResolvedValueOnce({}) },
        tourAdminAssignment: { delete: vi.fn().mockResolvedValueOnce({}) },
      })
    })
    mockGetAdminTourDetail.mockResolvedValueOnce(stubDetail)

    const result = await unassignAdmin('tour-1', 'ap-1')
    expect(result).toBe(stubDetail)
  })

  it('throws StaffInChargeRequiresReplacementError when removing staff-in-charge with other admins remaining', async () => {
    getDb().tour.findUnique.mockResolvedValueOnce({ staffInChargeId: 'ap-1' })
    getDb().tourAdminAssignment.count.mockResolvedValueOnce(2)

    await expect(unassignAdmin('tour-1', 'ap-1')).rejects.toThrow(StaffInChargeRequiresReplacementError)
    expect(getDb().$transaction).not.toHaveBeenCalled()
  })

  it('allows removing staff-in-charge when they are the only assigned admin', async () => {
    getDb().tour.findUnique.mockResolvedValueOnce({ staffInChargeId: 'ap-1' })
    getDb().tourAdminAssignment.count.mockResolvedValueOnce(1)
    getDb().$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        tour: { updateMany: vi.fn().mockResolvedValueOnce({}) },
        tourAdminAssignment: { delete: vi.fn().mockResolvedValueOnce({}) },
      })
    })
    mockGetAdminTourDetail.mockResolvedValueOnce(stubDetail)

    const result = await unassignAdmin('tour-1', 'ap-1')
    expect(result).toBe(stubDetail)
  })

  it('throws AdminNotAssignedError when assignment does not exist (P2025)', async () => {
    getDb().tour.findUnique.mockResolvedValueOnce({ staffInChargeId: null })
    getDb().tourAdminAssignment.count.mockResolvedValueOnce(0)
    getDb().$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      }),
    )

    await expect(unassignAdmin('tour-1', 'ap-1')).rejects.toThrow(AdminNotAssignedError)
  })
})

describe('setStaffInCharge', () => {
  it('sets staff-in-charge and returns updated tour detail', async () => {
    getDb().tourAdminAssignment.findUnique.mockResolvedValueOnce({ id: 'assign-1' })
    getDb().tour.update.mockResolvedValueOnce({})
    mockGetAdminTourDetail.mockResolvedValueOnce(stubDetail)

    const result = await setStaffInCharge('tour-1', 'ap-1')

    expect(getDb().tour.update).toHaveBeenCalledWith({
      where: { id: 'tour-1' },
      data: { staffInChargeId: 'ap-1' },
    })
    expect(result).toBe(stubDetail)
  })

  it('throws StaffInChargeNotAssignedError when admin is not assigned to tour', async () => {
    getDb().tourAdminAssignment.findUnique.mockResolvedValueOnce(null)
    await expect(setStaffInCharge('tour-1', 'ap-1')).rejects.toThrow(StaffInChargeNotAssignedError)
  })

  it('throws StaffInChargeRequiredError when clearing staff-in-charge while admins are assigned', async () => {
    getDb().tourAdminAssignment.count.mockResolvedValueOnce(1)
    await expect(setStaffInCharge('tour-1', null)).rejects.toThrow(StaffInChargeRequiredError)
    expect(getDb().tour.update).not.toHaveBeenCalled()
  })

  it('allows clearing staff-in-charge when no admins are assigned', async () => {
    getDb().tourAdminAssignment.count.mockResolvedValueOnce(0)
    getDb().tour.update.mockResolvedValueOnce({})
    mockGetAdminTourDetail.mockResolvedValueOnce(stubDetail)

    const result = await setStaffInCharge('tour-1', null)

    expect(getDb().tour.update).toHaveBeenCalledWith({
      where: { id: 'tour-1' },
      data: { staffInChargeId: null },
    })
    expect(result).toBe(stubDetail)
  })
})
