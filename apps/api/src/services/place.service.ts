import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import type { CreatePlace, UpdatePlace, CreateSpot, UpdateSpot, PlaceResponse, SpotResponse, PlaceDetailResponse } from '@peace-buddy/types'

const placeSelect = {
  id: true,
  nameJa: true,
  nameEn: true,
  sortOrder: true,
  active: true,
} as const

const spotSelect = {
  id: true,
  placeId: true,
  nameJa: true,
  nameEn: true,
  sortOrder: true,
  active: true,
} as const

function mapPlace(row: {
  id: string
  nameJa: string
  nameEn: string
  sortOrder: number
  active: boolean
}): PlaceResponse {
  return { id: row.id, nameJa: row.nameJa, nameEn: row.nameEn, sortOrder: row.sortOrder, active: row.active }
}

function mapSpot(row: {
  id: string
  placeId: string
  nameJa: string
  nameEn: string
  sortOrder: number
  active: boolean
}): SpotResponse {
  return {
    id: row.id,
    placeId: row.placeId,
    nameJa: row.nameJa,
    nameEn: row.nameEn,
    sortOrder: row.sortOrder,
    active: row.active,
  }
}

export async function listPlaces(): Promise<PlaceResponse[]> {
  const rows = await db.place.findMany({ select: placeSelect, orderBy: { sortOrder: 'asc' } })
  return rows.map(mapPlace)
}

export async function createPlace(data: CreatePlace): Promise<PlaceResponse> {
  const row = await db.place.create({ data, select: placeSelect })
  return mapPlace(row)
}

export async function updatePlace(id: string, data: UpdatePlace): Promise<PlaceResponse | null> {
  try {
    const row = await db.place.update({ where: { id }, data, select: placeSelect })
    return mapPlace(row)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return null
    throw e
  }
}

export async function getPlace(id: string): Promise<PlaceDetailResponse | null> {
  const row = await db.place.findUnique({
    where: { id },
    select: { ...placeSelect, spots: { select: spotSelect, orderBy: { sortOrder: 'asc' } } },
  })
  if (!row) return null
  return { ...mapPlace(row), spots: row.spots.map(mapSpot) }
}

export async function createSpot(placeId: string, data: CreateSpot): Promise<SpotResponse | null> {
  const place = await db.place.findUnique({ where: { id: placeId }, select: { id: true } })
  if (!place) return null
  const row = await db.spot.create({ data: { ...data, placeId }, select: spotSelect })
  return mapSpot(row)
}

// placeId scopes the lookup — Spot's only unique key is `id`, so this is a
// separate ownership check rather than a compound `where`.
export async function updateSpot(placeId: string, spotId: string, data: UpdateSpot): Promise<SpotResponse | null> {
  const existing = await db.spot.findUnique({ where: { id: spotId }, select: { placeId: true } })
  if (!existing || existing.placeId !== placeId) return null
  const row = await db.spot.update({ where: { id: spotId }, data, select: spotSelect })
  return mapSpot(row)
}
