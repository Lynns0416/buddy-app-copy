import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { TourStatusSchema, BookingStatusSchema } from '@peace-buddy/types'
import type {
  CreateSelfEvaluation,
  UpdateSelfEvaluation,
  SelfEvaluationResponse,
  AdminSelfEvaluationResponse,
} from '@peace-buddy/types'

export const SELF_EVAL_EDIT_WINDOW_DAYS = 7

export class EvalNotFoundError extends Error {
  constructor() {
    super('Self-evaluation not found')
  }
}

export class EvalAlreadyExistsError extends Error {
  constructor() {
    super('Self-evaluation already submitted for this tour')
  }
}

export class EvalLockedError extends Error {
  constructor() {
    super('Edit window has closed')
  }
}

export class NotEligibleError extends Error {
  constructor() {
    super('Not eligible to evaluate this tour')
  }
}

export class BuddyNotFoundError extends Error {
  constructor() {
    super('Buddy profile not found')
  }
}

function isLocked(createdAt: Date): boolean {
  const deadline = new Date(createdAt.getTime() + SELF_EVAL_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  return new Date() >= deadline
}

const selfEvalSelect = {
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
} as const

const adminSelfEvalSelect = {
  ...selfEvalSelect,
  buddy: { select: { displayName: true } },
} as const

type SelfEvalRow = {
  id: string
  buddyId: string
  tourId: string
  overallRating: number | null
  overallRatingNote: string | null
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
}

function mapScores(row: SelfEvalRow) {
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
  }
}

function mapResponse(row: SelfEvalRow): SelfEvaluationResponse {
  return {
    ...mapScores(row),
    locked: isLocked(row.createdAt),
  }
}

function mapAdminResponse(row: SelfEvalRow & { buddy: { displayName: string } }): AdminSelfEvaluationResponse {
  return {
    ...mapScores(row),
    buddyDisplayName: row.buddy.displayName,
  }
}

export async function createSelfEvaluation(
  data: CreateSelfEvaluation,
  userId: string,
): Promise<SelfEvaluationResponse> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const booking = await db.booking.findUnique({
    where: { buddyId_tourId: { buddyId: buddy.id, tourId: data.tourId } },
    select: { status: true, tour: { select: { status: true } } },
  })
  if (!booking || booking.status !== BookingStatusSchema.enum.confirmed || booking.tour.status !== TourStatusSchema.enum.completed) {
    throw new NotEligibleError()
  }

  try {
    const row = await db.selfEvaluation.create({
      data: {
        buddyId: buddy.id,
        tourId: data.tourId,
        overallRating: data.overallRating ?? null,
        overallRatingNote: data.overallRatingNote ?? null,
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
      select: selfEvalSelect,
    })
    return mapResponse(row)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new EvalAlreadyExistsError()
    }
    throw e
  }
}

export async function listMySelfEvaluations(userId: string): Promise<SelfEvaluationResponse[]> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const rows = await db.selfEvaluation.findMany({
    where: { buddyId: buddy.id },
    select: selfEvalSelect,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapResponse)
}

export async function updateSelfEvaluation(
  id: string,
  data: UpdateSelfEvaluation,
  userId: string,
): Promise<SelfEvaluationResponse> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const existing = await db.selfEvaluation.findUnique({
    where: { id },
    select: { buddyId: true, createdAt: true },
  })
  if (!existing || existing.buddyId !== buddy.id) throw new EvalNotFoundError()
  if (isLocked(existing.createdAt)) throw new EvalLockedError()

  const row = await db.selfEvaluation.update({
    where: { id },
    data: {
      ...(data.overallRating !== undefined ? { overallRating: data.overallRating ?? null } : {}),
      ...(data.overallRatingNote !== undefined ? { overallRatingNote: data.overallRatingNote ?? null } : {}),
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
    select: selfEvalSelect,
  })
  return mapResponse(row)
}

// Admin read-only access

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
