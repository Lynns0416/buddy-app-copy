import { db } from '../lib/db'
import type { UpsertAdminProfileEvaluation, AdminProfileEvaluationResponse } from '@peace-buddy/types'

export class BuddyNotFoundError extends Error {
  constructor() {
    super('Buddy not found')
  }
}

const profileEvalSelect = {
  id: true,
  buddyId: true,
  createdBy: true,
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
  createdBy: string
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
}): AdminProfileEvaluationResponse {
  return {
    id: row.id,
    buddyId: row.buddyId,
    createdBy: row.createdBy,
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

export async function upsertProfileEvaluation(
  buddyId: string,
  data: UpsertAdminProfileEvaluation,
  createdBy: string,
): Promise<AdminProfileEvaluationResponse> {
  const buddy = await db.buddyProfile.findUnique({ where: { id: buddyId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const createData = {
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
  }

  const updateData = {
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
  }

  const row = await db.adminProfileEvaluation.upsert({
    where: { buddyId },
    create: { buddyId, createdBy, ...createData },
    update: updateData,
    select: profileEvalSelect,
  })
  return mapResponse(row)
}

export async function getProfileEvaluation(
  buddyId: string,
): Promise<AdminProfileEvaluationResponse | null> {
  const row = await db.adminProfileEvaluation.findUnique({
    where: { buddyId },
    select: profileEvalSelect,
  })
  if (!row) return null
  return mapResponse(row)
}
