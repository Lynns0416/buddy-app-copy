import { TourStatus } from '@prisma/client'
import { db } from '../lib/db'
import type { TourResponse } from '@peace-buddy/types'
import type { ToursQuery } from '../types'

// Explicit select — never fetches adminMemo
const tourSelect = {
  id: true,
  groupId: true,
  group: { select: { id: true, name: true, type: true } },
  status: true,
  tourDate: true,
  meetingTime: true,
  location: true,
  capacity: true,
  description: true,
  cancellationDeadline: true,
  maybeDeadline: true,
  notificationOffsets: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function listTours(filters?: ToursQuery): Promise<TourResponse[]> {
  const tours = await db.tour.findMany({
    where: {
      status: (filters?.status as TourStatus | undefined) ?? TourStatus.published,
      ...(filters?.from || filters?.to
        ? {
            tourDate: {
              ...(filters?.from ? { gte: filters.from } : {}),
              ...(filters?.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    select: tourSelect,
    orderBy: { tourDate: 'asc' },
  })
  return tours as unknown as TourResponse[]
}
