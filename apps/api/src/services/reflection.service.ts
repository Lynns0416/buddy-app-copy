import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { TourStatusSchema, BookingStatusSchema, REFLECTION_PROMPTS } from '@peace-buddy/types'
import type {
  CreateTourReflection,
  UpdateTourReflection,
  TourReflectionResponse,
} from '@peace-buddy/types'

export const REFLECTION_EDIT_WINDOW_DAYS = 7

export class ReflectionNotFoundError extends Error {
  constructor() {
    super('Reflection not found')
  }
}

export class ReflectionAlreadyExistsError extends Error {
  constructor() {
    super('Reflection already written for this session')
  }
}

export class ReflectionLockedError extends Error {
  constructor() {
    super('Edit window has closed')
  }
}

export class NotEligibleError extends Error {
  constructor() {
    super('Not eligible to reflect on this session')
  }
}

export class BuddyNotFoundError extends Error {
  constructor() {
    super('Buddy profile not found')
  }
}

function isLocked(createdAt: Date): boolean {
  const deadline = new Date(createdAt.getTime() + REFLECTION_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  return new Date() >= deadline
}

const reflectionSelect = {
  id: true,
  buddyId: true,
  sessionId: true,
  didWell: true,
  couldImprove: true,
  memorableMoment: true,
  notesForOthers: true,
  openQuestions: true,
  createdAt: true,
  updatedAt: true,
  session: { select: { tourId: true, order: true, label: true } },
} as const

type ReflectionRow = Prisma.TourReflectionGetPayload<{ select: typeof reflectionSelect }>

function mapResponse(row: ReflectionRow): TourReflectionResponse {
  return {
    id: row.id,
    buddyId: row.buddyId,
    sessionId: row.sessionId,
    sessionOrder: row.session.order,
    sessionLabel: row.session.label,
    tourId: row.session.tourId,
    didWell: row.didWell,
    couldImprove: row.couldImprove,
    memorableMoment: row.memorableMoment,
    notesForOthers: row.notesForOthers,
    openQuestions: row.openQuestions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    locked: isLocked(row.createdAt),
  }
}

// The five prompts are written as one document: a PUT replaces all of them, so
// the schema's "at least one non-empty" rule holds on the stored row without
// reading it back first.
function promptColumns(data: CreateTourReflection | UpdateTourReflection) {
  return Object.fromEntries(
    REFLECTION_PROMPTS.map((key) => [key, data[key]?.trim() || null]),
  ) as Record<(typeof REFLECTION_PROMPTS)[number], string | null>
}

export async function createReflection(
  data: CreateTourReflection,
  userId: string,
): Promise<TourReflectionResponse> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const booking = await db.booking.findFirst({
    where: {
      buddyId: buddy.id,
      sessionId: data.sessionId,
      status: BookingStatusSchema.enum.confirmed,
    },
    select: { session: { select: { tour: { select: { status: true } } } } },
  })
  if (!booking || booking.session.tour.status !== TourStatusSchema.enum.completed) {
    throw new NotEligibleError()
  }

  try {
    const row = await db.tourReflection.create({
      data: { buddyId: buddy.id, sessionId: data.sessionId, ...promptColumns(data) },
      select: reflectionSelect,
    })
    return mapResponse(row)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ReflectionAlreadyExistsError()
    }
    throw e
  }
}

export async function listMyReflections(
  userId: string,
  filters: { tourId?: string } = {},
): Promise<TourReflectionResponse[]> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const rows = await db.tourReflection.findMany({
    where: {
      buddyId: buddy.id,
      ...(filters.tourId ? { session: { tourId: filters.tourId } } : {}),
    },
    select: reflectionSelect,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapResponse)
}

export async function updateReflection(
  id: string,
  data: UpdateTourReflection,
  userId: string,
): Promise<TourReflectionResponse> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) throw new BuddyNotFoundError()

  const existing = await db.tourReflection.findUnique({
    where: { id },
    select: { buddyId: true, createdAt: true },
  })
  if (!existing || existing.buddyId !== buddy.id) throw new ReflectionNotFoundError()
  if (isLocked(existing.createdAt)) throw new ReflectionLockedError()

  const row = await db.tourReflection.update({
    where: { id },
    data: promptColumns(data),
    select: reflectionSelect,
  })
  return mapResponse(row)
}
