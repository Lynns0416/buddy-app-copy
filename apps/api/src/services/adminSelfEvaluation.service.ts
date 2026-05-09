import { db } from '../lib/db'
import { Prisma } from '@prisma/client'
import type { AdminSelfEvaluationResponse } from '@peace-buddy/types'

const adminSelfEvalSelect = {
  id: true,
  buddyId: true,
  tourId: true,
  overallRating: true,
  overallRatingNote: true,
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
  buddy: { select: { displayName: true } },
} as const

type AdminSelfEvalRow = Prisma.SelfEvaluationGetPayload<{ select: typeof adminSelfEvalSelect }>

function mapAdminResponse(row: AdminSelfEvalRow): AdminSelfEvaluationResponse {
  return {
    id: row.id,
    buddyId: row.buddyId,
    tourId: row.tourId,
    overallRating: row.overallRating,
    overallRatingNote: row.overallRatingNote,
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
    buddyDisplayName: row.buddy.displayName,
  }
}

export async function listSelfEvaluations(filters: {
  buddyId?: string
}): Promise<AdminSelfEvaluationResponse[]> {
  const rows = await db.selfEvaluation.findMany({
    where: filters.buddyId ? { buddyId: filters.buddyId } : undefined,
    select: adminSelfEvalSelect,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapAdminResponse)
}

export async function getSelfEvaluation(id: string): Promise<AdminSelfEvaluationResponse | null> {
  const row = await db.selfEvaluation.findUnique({
    where: { id },
    select: adminSelfEvalSelect,
  })
  if (!row) return null
  return mapAdminResponse(row)
}
