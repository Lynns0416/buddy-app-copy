import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import type { AdminTourDetailResponse } from '@peace-buddy/types'
import { getAdminTourDetail, TourNotFoundError } from './adminTour.service'

export class AdminNotFoundError extends Error {}
export class AdminAlreadyAssignedError extends Error {}
export class AdminNotAssignedError extends Error {}
export class StaffInChargeNotAssignedError extends Error {}
export class StaffInChargeRequiresReplacementError extends Error {}
export class StaffInChargeRequiredError extends Error {}

export async function assignAdmin(tourId: string, adminId: string): Promise<AdminTourDetailResponse> {
  const admin = await db.adminProfile.findUnique({ where: { id: adminId }, select: { id: true, deletedAt: true } })
  if (!admin || admin.deletedAt !== null) throw new AdminNotFoundError()

  try {
    await db.tourAdminAssignment.create({ data: { tourId, adminId } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') throw new AdminAlreadyAssignedError()
      // P2003 (FK violation) can only originate from the tour side here:
      // admin existence was checked above, and admins are soft-deleted (never removed from DB).
      if (e.code === 'P2003') throw new TourNotFoundError()
    }
    throw e
  }

  return (await getAdminTourDetail(tourId))!
}

export async function unassignAdmin(tourId: string, adminId: string): Promise<AdminTourDetailResponse> {
  const [tour, assignmentCount] = await Promise.all([
    db.tour.findUnique({ where: { id: tourId }, select: { staffInChargeId: true } }),
    db.tourAdminAssignment.count({ where: { tourId } }),
  ])

  if (tour?.staffInChargeId === adminId && assignmentCount > 1) {
    throw new StaffInChargeRequiresReplacementError()
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.tour.updateMany({
        where: { id: tourId, staffInChargeId: adminId },
        data: { staffInChargeId: null },
      })
      await tx.tourAdminAssignment.delete({ where: { tourId_adminId: { tourId, adminId } } })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new AdminNotAssignedError()
    throw e
  }

  return (await getAdminTourDetail(tourId))!
}

export async function setStaffInCharge(tourId: string, adminId: string | null): Promise<AdminTourDetailResponse> {
  if (adminId === null) {
    const count = await db.tourAdminAssignment.count({ where: { tourId } })
    if (count > 0) throw new StaffInChargeRequiredError()
  } else {
    const assignment = await db.tourAdminAssignment.findUnique({
      where: { tourId_adminId: { tourId, adminId } },
      select: { id: true },
    })
    if (!assignment) throw new StaffInChargeNotAssignedError()
  }

  try {
    await db.tour.update({ where: { id: tourId }, data: { staffInChargeId: adminId } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new TourNotFoundError()
    throw e
  }
  return (await getAdminTourDetail(tourId))!
}
