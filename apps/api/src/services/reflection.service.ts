import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { TourStatusSchema, BookingStatusSchema, REFLECTION_PROMPTS } from '@peace-buddy/types'
import type {
  CreateTourReflection,
  UpdateTourReflection,
  TourReflectionResponse,
  TourReflectionMomentResponse,
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

export class InvalidSpotError extends Error {
  constructor() {
    super('Spot is not at this session\'s place')
  }
}

function isLocked(createdAt: Date): boolean {
  const deadline = new Date(createdAt.getTime() + REFLECTION_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  return new Date() >= deadline
}

// Shared with adminReflection.service.ts, so the two response shapes cannot
// drift on how a moment's spot/place is resolved.
export const momentSelect = {
  id: true,
  position: true,
  spotId: true,
  placeNote: true,
  description: true,
  spot: {
    select: {
      id: true,
      nameJa: true,
      nameEn: true,
      place: { select: { id: true, nameJa: true, nameEn: true } },
    },
  },
} as const

type MomentRow = Prisma.TourReflectionMomentGetPayload<{ select: typeof momentSelect }>

export function mapMoment(row: MomentRow): TourReflectionMomentResponse {
  return {
    id: row.id,
    position: row.position,
    spotId: row.spotId,
    placeNote: row.placeNote,
    description: row.description,
    spot: row.spot,
  }
}

const reflectionSelect = {
  id: true,
  buddyId: true,
  sessionId: true,
  didWell: true,
  couldImprove: true,
  notesForOthers: true,
  openQuestions: true,
  createdAt: true,
  updatedAt: true,
  session: { select: { tourId: true, order: true, label: true } },
  moments: { select: momentSelect, orderBy: { position: 'asc' as const } },
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
    notesForOthers: row.notesForOthers,
    openQuestions: row.openQuestions,
    moments: row.moments.map(mapMoment),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    locked: isLocked(row.createdAt),
  }
}

function momentCreateData(moments: CreateTourReflection['moments']) {
  return moments.map((m, idx) => ({
    position: idx,
    spotId: m.spotId ?? null,
    placeNote: m.placeNote || null,
    description: m.description,
  }))
}

// A moment's spot must be a spot of the session's place — the lock on changing
// a session's place in updateSession (PlaceInUseError) relies on it. Active is
// not required: a PUT resends every moment, including one tagged before its
// spot was retired.
async function assertSpotsAtSessionPlace(moments: CreateTourReflection['moments'], placeId: string): Promise<void> {
  const spotIds = [...new Set(moments.flatMap((m) => (m.spotId ? [m.spotId] : [])))]
  if (spotIds.length === 0) return
  const found = await db.spot.count({
    where: { id: { in: spotIds }, placeId },
  })
  if (found !== spotIds.length) throw new InvalidSpotError()
}

// The four prompts are written as one document: a PUT replaces all of them, so
// the schema's "at least one prompt or moment" rule holds on the stored row
// without reading it back first.
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
    select: { session: { select: { placeId: true, tour: { select: { status: true } } } } },
  })
  if (!booking || booking.session.tour.status !== TourStatusSchema.enum.completed) {
    throw new NotEligibleError()
  }
  await assertSpotsAtSessionPlace(data.moments, booking.session.placeId)

  try {
    const row = await db.tourReflection.create({
      data: {
        buddyId: buddy.id,
        sessionId: data.sessionId,
        ...promptColumns(data),
        moments: { create: momentCreateData(data.moments) },
      },
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
    select: { buddyId: true, createdAt: true, session: { select: { placeId: true } } },
  })
  if (!existing || existing.buddyId !== buddy.id) throw new ReflectionNotFoundError()
  if (isLocked(existing.createdAt)) throw new ReflectionLockedError()
  await assertSpotsAtSessionPlace(data.moments, existing.session.placeId)

  // Moments are one document like the four prompts: a PUT deletes and
  // recreates all of them in the same transaction (rule 8), rather than
  // diffing against the stored rows.
  await db.$transaction(async (tx) => {
    await tx.tourReflection.update({ where: { id }, data: promptColumns(data) })
    await tx.tourReflectionMoment.deleteMany({ where: { reflectionId: id } })
    if (data.moments.length > 0) {
      await tx.tourReflectionMoment.createMany({
        data: momentCreateData(data.moments).map((m) => ({ ...m, reflectionId: id })),
      })
    }
  })

  const row = await db.tourReflection.findUniqueOrThrow({ where: { id }, select: reflectionSelect })
  return mapResponse(row)
}
