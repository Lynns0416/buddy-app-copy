import type { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { getTour } from './tour.service'
import {
  AnnouncementAudienceSchema,
  AnnouncementBuddyStatusSchema,
  BookingStatusSchema,
  TourStatusSchema,
  getTodayJst,
  jstStartOfDayUtc,
} from '@peace-buddy/types'
import type {
  AdminAnnouncementResponse,
  AnnouncementAudience,
  AnnouncementAudienceInput,
  AnnouncementBuddyStatus,
  BuddyStatus,
  BuddyTier,
  MyAnnouncementResponse,
  UpsertAnnouncement,
} from '@peace-buddy/types'

// Announcements (#266, PRD §11.11). Not a notification: nothing is sent, and
// the audience is matched on every read, never stored as a list of recipients
// except for buddies picked by name.

export class AnnouncementNotFoundError extends Error {
  constructor() {
    super('Announcement not found')
  }
}

// A linked tour or a picked buddy that does not exist.
export class AnnouncementReferenceError extends Error {
  constructor() {
    super('Linked tour or picked buddy not found')
  }
}

// A reorder whose ids are not every announcement exactly once.
export class AnnouncementOrderMismatchError extends Error {
  constructor() {
    super('ids must list every announcement exactly once')
  }
}

const HOME_STATUSES: BuddyStatus[] = [...AnnouncementBuddyStatusSchema.options]

const adminSelect = {
  id: true,
  titleJa: true,
  bodyJa: true,
  titleEn: true,
  bodyEn: true,
  audience: true,
  statuses: true,
  tiers: true,
  startDate: true,
  endDate: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  tour: { select: { id: true, tourDate: true, group: { select: { name: true } } } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  recipients: { select: { buddy: { select: { id: true, displayName: true, realName: true } } } },
} as const

type AdminRow = Prisma.AnnouncementGetPayload<{ select: typeof adminSelect }>

function dateOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mapAdmin(row: AdminRow): AdminAnnouncementResponse {
  return {
    id: row.id,
    titleJa: row.titleJa,
    bodyJa: row.bodyJa,
    titleEn: row.titleEn,
    bodyEn: row.bodyEn,
    audience: row.audience,
    statuses: row.statuses as AnnouncementBuddyStatus[],
    tiers: row.tiers,
    buddies: row.recipients.map((r) => r.buddy),
    startDate: dateOf(row.startDate),
    endDate: dateOf(row.endDate),
    position: row.position,
    tour: row.tour ? { id: row.tour.id, tourDate: row.tour.tourDate.toISOString(), groupName: row.tour.group.name } : null,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// The buddies a rule matches: statuses AND tiers, an empty list meaning any.
// A tier in the rule never matches a buddy without one (a trainee).
function ruleWhere(statuses: BuddyStatus[], tiers: BuddyTier[]): Prisma.BuddyProfileWhereInput {
  return {
    status: { in: statuses.length > 0 ? statuses : HOME_STATUSES },
    ...(tiers.length > 0 ? { tier: { in: tiers } } : {}),
  }
}

export async function countAudience(input: AnnouncementAudienceInput): Promise<number> {
  const where: Prisma.BuddyProfileWhereInput =
    input.audience === AnnouncementAudienceSchema.enum.rule
      ? ruleWhere(input.statuses, input.tiers)
      : { id: { in: input.buddyIds }, status: { in: HOME_STATUSES } }
  return db.buddyProfile.count({ where })
}

export async function listAnnouncements(): Promise<AdminAnnouncementResponse[]> {
  const rows = await db.announcement.findMany({
    select: adminSelect,
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  })
  return rows.map(mapAdmin)
}

export async function getAnnouncement(id: string): Promise<AdminAnnouncementResponse | null> {
  const row = await db.announcement.findUnique({ where: { id }, select: adminSelect })
  return row ? mapAdmin(row) : null
}

async function assertReferencesExist(data: UpsertAnnouncement): Promise<void> {
  if (data.tourId) {
    const tour = await db.tour.findUnique({ where: { id: data.tourId }, select: { id: true } })
    if (!tour) throw new AnnouncementReferenceError()
  }
  if (data.audience === AnnouncementAudienceSchema.enum.selected) {
    const ids = [...new Set(data.buddyIds)]
    const found = await db.buddyProfile.count({ where: { id: { in: ids } } })
    if (found !== ids.length) throw new AnnouncementReferenceError()
  }
}

async function adminProfileId(userId: string): Promise<string> {
  const profile = await db.adminProfile.findUniqueOrThrow({ where: { userId }, select: { id: true } })
  return profile.id
}

// Only the fields the audience uses are kept, so a rule never carries picked
// buddies and the other way round.
function contentData(data: UpsertAnnouncement) {
  const isRule = data.audience === AnnouncementAudienceSchema.enum.rule
  return {
    titleJa: data.titleJa,
    bodyJa: data.bodyJa,
    titleEn: data.titleEn,
    bodyEn: data.bodyEn,
    audience: data.audience,
    statuses: isRule ? data.statuses : [],
    tiers: isRule ? data.tiers : [],
    startDate: new Date(`${data.startDate}T00:00:00.000Z`),
    endDate: new Date(`${data.endDate}T00:00:00.000Z`),
    tourId: data.tourId,
  }
}

function recipientRows(audience: AnnouncementAudience, buddyIds: string[]) {
  return audience === AnnouncementAudienceSchema.enum.selected
    ? [...new Set(buddyIds)].map((buddyId) => ({ buddyId }))
    : []
}

// A new announcement goes to the top: it is what the member wants seen now.
export async function createAnnouncement(data: UpsertAnnouncement, userId: string): Promise<AdminAnnouncementResponse> {
  await assertReferencesExist(data)
  const authorId = await adminProfileId(userId)

  const row = await db.$transaction(async (tx) => {
    const top = await tx.announcement.aggregate({ _min: { position: true } })
    return tx.announcement.create({
      data: {
        ...contentData(data),
        position: (top._min.position ?? 1) - 1,
        createdById: authorId,
        updatedById: authorId,
        recipients: { create: recipientRows(data.audience, data.buddyIds) },
      },
      select: adminSelect,
    })
  })
  return mapAdmin(row)
}

export async function updateAnnouncement(
  id: string,
  data: UpsertAnnouncement,
  userId: string,
): Promise<AdminAnnouncementResponse> {
  const existing = await db.announcement.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new AnnouncementNotFoundError()
  await assertReferencesExist(data)
  const editorId = await adminProfileId(userId)

  const row = await db.$transaction(async (tx) => {
    await tx.announcementRecipient.deleteMany({ where: { announcementId: id } })
    return tx.announcement.update({
      where: { id },
      data: {
        ...contentData(data),
        updatedById: editorId,
        recipients: { create: recipientRows(data.audience, data.buddyIds) },
      },
      select: adminSelect,
    })
  })
  return mapAdmin(row)
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const existing = await db.announcement.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new AnnouncementNotFoundError()
  await db.announcement.delete({ where: { id } })
}

export async function reorderAnnouncements(ids: string[]): Promise<AdminAnnouncementResponse[]> {
  const all = await db.announcement.findMany({ select: { id: true } })
  const given = new Set(ids)
  if (given.size !== ids.length || given.size !== all.length || all.some((a) => !given.has(a.id))) {
    throw new AnnouncementOrderMismatchError()
  }

  await db.$transaction(ids.map((id, position) => db.announcement.update({ where: { id }, data: { position } })))
  return listAnnouncements()
}

// A tour-linked announcement shows to this buddy only while the tour still
// needs buddies and the buddy could take one of the seats: a session short of
// buddies (PRD §11.7) where they hold no booking and their tier pool has room,
// on a tour still open for booking (createBooking's rule: after today, open).
// The pool rule is getTour's `myRemaining`, not a copy of it. getTour hides a
// tour from trainees, so they never see a tour-linked announcement.
async function tourNeedsBuddy(tourId: string, userId: string, today: string): Promise<boolean> {
  const tour = await getTour(tourId, userId)
  if (!tour) return false
  if (tour.status !== TourStatusSchema.enum.published) return false
  if (!tour.bookingOpen) return false
  if (tour.tourDate.slice(0, 10) <= today) return false

  return tour.sessions.some(
    (s) =>
      s.seatCounts.confirmed < s.minBuddies &&
      (s.myBookingStatus === null || s.myBookingStatus === BookingStatusSchema.enum.declined) &&
      (s.myRemaining ?? 0) > 0,
  )
}

export async function listMyAnnouncements(userId: string): Promise<MyAnnouncementResponse[]> {
  const buddy = await db.buddyProfile.findUnique({
    where: { userId },
    select: { id: true, status: true, tier: true },
  })
  if (!buddy || !HOME_STATUSES.includes(buddy.status)) return []

  const todayDate = jstStartOfDayUtc()
  const rows = await db.announcement.findMany({
    where: {
      startDate: { lte: todayDate },
      endDate: { gte: todayDate },
      OR: [
        {
          audience: AnnouncementAudienceSchema.enum.rule,
          AND: [
            { OR: [{ statuses: { isEmpty: true } }, { statuses: { has: buddy.status } }] },
            buddy.tier
              ? { OR: [{ tiers: { isEmpty: true } }, { tiers: { has: buddy.tier } }] }
              : { tiers: { isEmpty: true } },
          ],
        },
        { audience: AnnouncementAudienceSchema.enum.selected, recipients: { some: { buddyId: buddy.id } } },
      ],
    },
    select: { id: true, titleJa: true, bodyJa: true, titleEn: true, bodyEn: true, tourId: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  })

  const today = getTodayJst()
  const tourIds = [...new Set(rows.flatMap((r) => (r.tourId ? [r.tourId] : [])))]
  const needed = new Map(
    await Promise.all(tourIds.map(async (id) => [id, await tourNeedsBuddy(id, userId, today)] as const)),
  )

  return rows.filter((r) => r.tourId === null || needed.get(r.tourId))
}
