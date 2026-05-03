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
}): AdminProfileEvaluationResponse {
  return {
    id: row.id,
    buddyId: row.buddyId,
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

const ALL_SCORE_KEYS = [
  'overallRating', 'overallRatingNote',
  'reliability', 'reliabilityNote',
  'communication', 'communicationNote',
  'groupEngagement', 'groupEngagementNote',
  'memory', 'memoryNote',
  'knowledge', 'knowledgeNote',
  'dedication', 'dedicationNote',
  'dialogue', 'dialogueNote',
  'adaptability', 'adaptabilityNote',
  'emotionNote',
  'confidence', 'confidenceNote',
] as const


function createScoreData(data: UpsertAdminProfileEvaluation): Record<string, number | string | null> {
  return Object.fromEntries(ALL_SCORE_KEYS.map((k) => [k, data[k] ?? null]))
}

function updateScoreData(data: UpsertAdminProfileEvaluation): Record<string, number | string | null> {
  return Object.fromEntries(
    ALL_SCORE_KEYS
      .filter((k) => data[k] !== undefined)
      .map((k) => [k, data[k] ?? null]),
  )
}

export async function upsertProfileEvaluation(
  buddyId: string,
  data: UpsertAdminProfileEvaluation,
  createdBy: string,
): Promise<AdminProfileEvaluationResponse> {
  const buddy = await db.buddyProfile.findUnique({ where: { id: buddyId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const row = await db.adminProfileEvaluation.upsert({
    where: { buddyId_createdBy: { buddyId, createdBy } },
    create: { buddyId, createdBy, ...createScoreData(data) },
    update: updateScoreData(data),
    select: profileEvalSelect,
  })
  return mapResponse(row)
}

export async function getMyProfileEvaluation(
  buddyId: string,
  adminId: string,
): Promise<AdminProfileEvaluationResponse | null> {
  const row = await db.adminProfileEvaluation.findUnique({
    where: { buddyId_createdBy: { buddyId, createdBy: adminId } },
    select: profileEvalSelect,
  })
  if (!row) return null
  return mapResponse(row)
}

export async function listProfileEvaluations(
  buddyId: string,
): Promise<AdminProfileEvaluationResponse[]> {
  const rows = await db.adminProfileEvaluation.findMany({
    where: { buddyId },
    orderBy: { createdAt: 'asc' },
    select: profileEvalSelect,
  })
  return rows.map(mapResponse)
}
