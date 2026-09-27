import { db } from '../lib/db'
import { Prisma } from '@prisma/client'
import type { AdminTourReflectionResponse } from '@peace-buddy/types'
import { momentSelect, mapMoment } from './reflection.service'

export const adminReflectionSelect = {
  id: true,
  buddyId: true,
  sessionId: true,
  didWell: true,
  couldImprove: true,
  notesForOthers: true,
  openQuestions: true,
  createdAt: true,
  updatedAt: true,
  buddy: { select: { displayName: true } },
  session: { select: { tourId: true, order: true, label: true, tour: { select: { tourDate: true } } } },
  moments: { select: momentSelect, orderBy: { position: 'asc' as const } },
} as const

type AdminReflectionRow = Prisma.TourReflectionGetPayload<{ select: typeof adminReflectionSelect }>

export function mapAdminResponse(row: AdminReflectionRow): AdminTourReflectionResponse {
  return {
    id: row.id,
    buddyId: row.buddyId,
    buddyDisplayName: row.buddy.displayName,
    sessionId: row.sessionId,
    sessionOrder: row.session.order,
    sessionLabel: row.session.label,
    tourId: row.session.tourId,
    tourDate: row.session.tour.tourDate.toISOString(),
    didWell: row.didWell,
    couldImprove: row.couldImprove,
    notesForOthers: row.notesForOthers,
    openQuestions: row.openQuestions,
    moments: row.moments.map(mapMoment),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listReflections(filters: {
  buddyId?: string
}): Promise<AdminTourReflectionResponse[]> {
  const rows = await db.tourReflection.findMany({
    where: filters.buddyId ? { buddyId: filters.buddyId } : undefined,
    select: adminReflectionSelect,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapAdminResponse)
}

export async function getReflection(id: string): Promise<AdminTourReflectionResponse | null> {
  const row = await db.tourReflection.findUnique({
    where: { id },
    select: adminReflectionSelect,
  })
  if (!row) return null
  return mapAdminResponse(row)
}
