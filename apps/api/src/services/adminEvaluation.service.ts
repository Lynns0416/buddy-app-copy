import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import type { CreateAdminEvaluation, UpdateAdminEvaluation, AdminEvaluationResponse } from '@peace-buddy/types'

export class EvalNotFoundError extends Error {
  constructor() {
    super('Evaluation not found')
  }
}

export class EvalAlreadyExistsError extends Error {
  constructor() {
    super('Evaluation already exists for this buddy and tour')
  }
}

export class EvalOwnershipError extends Error {
  constructor() {
    super('You do not own this evaluation')
  }
}

export class BuddyNotFoundError extends Error {
  constructor() {
    super('Buddy not found')
  }
}

export class TourNotFoundError extends Error {
  constructor() {
    super('Tour not found')
  }
}

const adminEvalSelect = {
  id: true,
  buddyId: true,
  buddy: { select: { displayName: true } },
  tourId: true,
  tour: { select: { tourDate: true, group: { select: { name: true } } } },
  createdBy: true,
  creator: { select: { email: true, adminProfile: { select: { name: true } } } },
  overallRating: true,
  overallRatingNote: true,
  reliability: true,
  reliabilityNote: true,
  communication: true,
  communicationNote: true,
  groupEngagement: true,
  groupEngagementNote: true,
  memory: true,
  memoryNote: true,
  knowledge: true,
  knowledgeNote: true,
  dedication: true,
  dedicationNote: true,
  dialogue: true,
  dialogueNote: true,
  adaptability: true,
  adaptabilityNote: true,
  emotionNote: true,
  confidence: true,
  confidenceNote: true,
  createdAt: true,
  updatedAt: true,
} as const

function mapResponse(row: {
  id: string
  buddyId: string
  buddy: { displayName: string }
  tourId: string
  tour: { tourDate: Date; group: { name: string } }
  createdBy: string
  creator: { email: string; adminProfile: { name: string } | null }
  overallRating: number | null
  overallRatingNote: string | null
  reliability: number | null
  reliabilityNote: string | null
  communication: number | null
  communicationNote: string | null
  groupEngagement: number | null
  groupEngagementNote: string | null
  memory: number | null
  memoryNote: string | null
  knowledge: number | null
  knowledgeNote: string | null
  dedication: number | null
  dedicationNote: string | null
  dialogue: number | null
  dialogueNote: string | null
  adaptability: number | null
  adaptabilityNote: string | null
  emotionNote: string | null
  confidence: number | null
  confidenceNote: string | null
  createdAt: Date
  updatedAt: Date
}): AdminEvaluationResponse {
  return {
    id: row.id,
    buddyId: row.buddyId,
    buddyDisplayName: row.buddy.displayName,
    tourId: row.tourId,
    tourDate: row.tour.tourDate.toISOString(),
    tourGroupName: row.tour.group.name,
    createdBy: row.createdBy,
    createdByName: row.creator.adminProfile?.name ?? row.creator.email.split('@')[0],
    overallRating: row.overallRating,
    overallRatingNote: row.overallRatingNote,
    reliability: row.reliability,
    reliabilityNote: row.reliabilityNote,
    communication: row.communication,
    communicationNote: row.communicationNote,
    groupEngagement: row.groupEngagement,
    groupEngagementNote: row.groupEngagementNote,
    memory: row.memory,
    memoryNote: row.memoryNote,
    knowledge: row.knowledge,
    knowledgeNote: row.knowledgeNote,
    dedication: row.dedication,
    dedicationNote: row.dedicationNote,
    dialogue: row.dialogue,
    dialogueNote: row.dialogueNote,
    adaptability: row.adaptability,
    adaptabilityNote: row.adaptabilityNote,
    emotionNote: row.emotionNote,
    confidence: row.confidence,
    confidenceNote: row.confidenceNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createAdminEvaluation(
  data: CreateAdminEvaluation,
  createdBy: string,
): Promise<AdminEvaluationResponse> {
  const [buddy, tour] = await Promise.all([
    db.buddyProfile.findUnique({ where: { id: data.buddyId }, select: { id: true } }),
    db.tour.findUnique({ where: { id: data.tourId }, select: { id: true } }),
  ])
  if (!buddy) throw new BuddyNotFoundError()
  if (!tour) throw new TourNotFoundError()

  try {
    const row = await db.adminEvaluation.create({
      data: {
        buddyId: data.buddyId,
        tourId: data.tourId,
        createdBy,
        overallRating: data.overallRating ?? null,
        overallRatingNote: data.overallRatingNote ?? null,
        reliability: data.reliability ?? null,
        reliabilityNote: data.reliabilityNote ?? null,
        communication: data.communication ?? null,
        communicationNote: data.communicationNote ?? null,
        groupEngagement: data.groupEngagement ?? null,
        groupEngagementNote: data.groupEngagementNote ?? null,
        memory: data.memory ?? null,
        memoryNote: data.memoryNote ?? null,
        knowledge: data.knowledge ?? null,
        knowledgeNote: data.knowledgeNote ?? null,
        dedication: data.dedication ?? null,
        dedicationNote: data.dedicationNote ?? null,
        dialogue: data.dialogue ?? null,
        dialogueNote: data.dialogueNote ?? null,
        adaptability: data.adaptability ?? null,
        adaptabilityNote: data.adaptabilityNote ?? null,
        emotionNote: data.emotionNote ?? null,
        confidence: data.confidence ?? null,
        confidenceNote: data.confidenceNote ?? null,
      },
      select: adminEvalSelect,
    })
    return mapResponse(row)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new EvalAlreadyExistsError()
    }
    throw e
  }
}

export async function listAdminEvaluations(filters: {
  buddyId?: string
  tourId?: string
}): Promise<AdminEvaluationResponse[]> {
  const where: Prisma.AdminEvaluationWhereInput = {}
  if (filters.buddyId) where.buddyId = filters.buddyId
  if (filters.tourId) where.tourId = filters.tourId

  const rows = await db.adminEvaluation.findMany({
    where,
    select: adminEvalSelect,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapResponse)
}

export async function getAdminEvaluation(id: string): Promise<AdminEvaluationResponse | null> {
  const row = await db.adminEvaluation.findUnique({
    where: { id },
    select: adminEvalSelect,
  })
  if (!row) return null
  return mapResponse(row)
}

export async function updateAdminEvaluation(
  id: string,
  data: UpdateAdminEvaluation,
  requesterId: string,
): Promise<AdminEvaluationResponse> {
  const existing = await db.adminEvaluation.findUnique({ where: { id }, select: { createdBy: true } })
  if (!existing) throw new EvalNotFoundError()
  if (existing.createdBy !== requesterId) throw new EvalOwnershipError()

  try {
    const row = await db.adminEvaluation.update({
      where: { id },
      data: {
        ...(data.overallRating !== undefined ? { overallRating: data.overallRating ?? null } : {}),
        ...(data.overallRatingNote !== undefined ? { overallRatingNote: data.overallRatingNote ?? null } : {}),
        ...(data.reliability !== undefined ? { reliability: data.reliability ?? null } : {}),
        ...(data.reliabilityNote !== undefined ? { reliabilityNote: data.reliabilityNote ?? null } : {}),
        ...(data.communication !== undefined ? { communication: data.communication ?? null } : {}),
        ...(data.communicationNote !== undefined ? { communicationNote: data.communicationNote ?? null } : {}),
        ...(data.groupEngagement !== undefined ? { groupEngagement: data.groupEngagement ?? null } : {}),
        ...(data.groupEngagementNote !== undefined ? { groupEngagementNote: data.groupEngagementNote ?? null } : {}),
        ...(data.memory !== undefined ? { memory: data.memory ?? null } : {}),
        ...(data.memoryNote !== undefined ? { memoryNote: data.memoryNote ?? null } : {}),
        ...(data.knowledge !== undefined ? { knowledge: data.knowledge ?? null } : {}),
        ...(data.knowledgeNote !== undefined ? { knowledgeNote: data.knowledgeNote ?? null } : {}),
        ...(data.dedication !== undefined ? { dedication: data.dedication ?? null } : {}),
        ...(data.dedicationNote !== undefined ? { dedicationNote: data.dedicationNote ?? null } : {}),
        ...(data.dialogue !== undefined ? { dialogue: data.dialogue ?? null } : {}),
        ...(data.dialogueNote !== undefined ? { dialogueNote: data.dialogueNote ?? null } : {}),
        ...(data.adaptability !== undefined ? { adaptability: data.adaptability ?? null } : {}),
        ...(data.adaptabilityNote !== undefined ? { adaptabilityNote: data.adaptabilityNote ?? null } : {}),
        ...(data.emotionNote !== undefined ? { emotionNote: data.emotionNote ?? null } : {}),
        ...(data.confidence !== undefined ? { confidence: data.confidence ?? null } : {}),
        ...(data.confidenceNote !== undefined ? { confidenceNote: data.confidenceNote ?? null } : {}),
      },
      select: adminEvalSelect,
    })
    return mapResponse(row)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new EvalNotFoundError()
    }
    throw e
  }
}

export async function deleteAdminEvaluation(id: string, requesterId: string): Promise<void> {
  const existing = await db.adminEvaluation.findUnique({ where: { id }, select: { createdBy: true } })
  if (!existing) throw new EvalNotFoundError()
  if (existing.createdBy !== requesterId) throw new EvalOwnershipError()

  try {
    await db.adminEvaluation.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new EvalNotFoundError()
    }
    throw e
  }
}
