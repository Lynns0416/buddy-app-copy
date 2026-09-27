import type { Prisma } from '@prisma/client'
import type {
  AdminReflectionStatsBuddy,
  AdminReflectionStatsResponse,
  GroupType,
  MemberType,
} from '@peace-buddy/types'
import { db } from '../lib/db'
import { placeSummarySelect } from '../lib/sessionPlaces'
import type { BuddyStatsScope } from '../types'
import { listBuddyStats, tourWhere } from './adminBuddyStats.service'
import { adminReflectionSelect, mapAdminResponse } from './adminReflection.service'

const reflectionStatsSelect = {
  ...adminReflectionSelect,
  buddy: { select: { displayName: true, realName: true, memberType: true } },
  session: {
    select: {
      tourId: true,
      order: true,
      label: true,
      place: { select: placeSummarySelect },
      tour: { select: { tourDate: true, group: { select: { name: true, type: true } } } },
    },
  },
} as const

type ReflectionStatsRow = Prisma.TourReflectionGetPayload<{ select: typeof reflectionStatsSelect }>

// Every reflection in scope, with the numbers the page divides them by
// (PRD §11.4 "Reflection Stats Page"). The overview is computed in the browser.
export async function listReflectionStats(
  scope: BuddyStatsScope,
  now: Date = new Date(),
): Promise<AdminReflectionStatsResponse> {
  const [rows, buddyStats, places] = await Promise.all([
    db.tourReflection.findMany({
      where: { session: { tour: tourWhere(scope), ...(scope.placeId ? { placeId: scope.placeId } : {}) } },
      select: reflectionStatsSelect,
      orderBy: { createdAt: 'desc' },
    }),
    // Sessions attended are counted by the buddy stats, so the reflection rate
    // here and on the buddy stats page cannot drift apart.
    listBuddyStats(scope, now),
    db.place.findMany({
      select: {
        ...placeSummarySelect,
        active: true,
        spots: { select: { ...placeSummarySelect, active: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const reflections = rows.map((row: ReflectionStatsRow) => ({
    ...mapAdminResponse(row),
    buddyRealName: row.buddy.realName,
    buddyMemberType: row.buddy.memberType as MemberType,
    group: { name: row.session.tour.group.name, type: row.session.tour.group.type as GroupType },
    place: row.session.place,
  }))

  const buddies: AdminReflectionStatsBuddy[] = buddyStats.buddies
    .filter((b) => b.stats.sessionsAttended > 0)
    .map((b) => ({
      id: b.id,
      displayName: b.displayName,
      realName: b.realName,
      memberType: b.memberType,
      sessionsAttended: b.stats.sessionsAttended,
    }))

  return { reflections, buddies, places }
}
