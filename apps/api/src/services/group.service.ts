import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import type { CreateGroup, UpdateGroup, GroupResponse, GroupDetailResponse, GroupTourSummary, GroupType, TourStatus } from '@peace-buddy/types'

const groupSelect = {
  id: true,
  name: true,
  type: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const

const groupTourSelect = {
  id: true,
  status: true,
  tourDate: true,
  bookingOpen: true,
  location: true,
  participantCount: true,
  description: true,
  createdAt: true,
  sessions: {
    select: {
      id: true,
      order: true,
      label: true,
      meetingTime: true,
      startTime: true,
      endTime: true,
      capacity: true,
      participantCount: true,
    },
    orderBy: { order: 'asc' as const },
  },
} as const

function mapGroup(raw: {
  id: string
  name: string
  type: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): GroupResponse {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type as GroupType,
    contactName: raw.contactName,
    contactEmail: raw.contactEmail,
    contactPhone: raw.contactPhone,
    notes: raw.notes,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  }
}

function mapGroupTour(raw: {
  id: string
  status: string
  tourDate: Date
  bookingOpen: boolean
  location: string
  participantCount: number
  description: string | null
  createdAt: Date
  sessions: {
    id: string
    order: number
    label: string | null
    meetingTime: Date
    startTime: Date | null
    endTime: Date | null
    capacity: number
    participantCount: number
  }[]
}): GroupTourSummary {
  return {
    id: raw.id,
    status: raw.status as TourStatus,
    tourDate: raw.tourDate.toISOString(),
    bookingOpen: raw.bookingOpen,
    location: raw.location,
    participantCount: raw.participantCount,
    description: raw.description,
    sessions: raw.sessions.map((s) => ({
      id: s.id,
      order: s.order,
      label: s.label,
      meetingTime: s.meetingTime.toISOString(),
      startTime: s.startTime ? s.startTime.toISOString() : null,
      endTime: s.endTime ? s.endTime.toISOString() : null,
      capacity: s.capacity,
      participantCount: s.participantCount,
    })),
    createdAt: raw.createdAt.toISOString(),
  }
}

export async function listGroups(): Promise<GroupResponse[]> {
  const rows = await db.group.findMany({
    select: groupSelect,
    orderBy: { name: 'asc' },
  })
  return rows.map(mapGroup)
}

export async function createGroup(data: CreateGroup): Promise<GroupResponse> {
  const row = await db.group.create({
    data,
    select: groupSelect,
  })
  return mapGroup(row)
}

export async function updateGroup(id: string, data: UpdateGroup): Promise<GroupResponse | null> {
  try {
    const row = await db.group.update({
      where: { id },
      data,
      select: groupSelect,
    })
    return mapGroup(row)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return null
    throw e
  }
}

export async function getGroup(id: string): Promise<GroupDetailResponse | null> {
  const row = await db.group.findUnique({
    where: { id },
    select: {
      ...groupSelect,
      tours: {
        select: groupTourSelect,
        orderBy: { tourDate: 'desc' },
      },
    },
  })
  if (!row) return null
  return {
    ...mapGroup(row),
    tours: row.tours.map(mapGroupTour),
  }
}
