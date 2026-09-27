import type {
  AdminReflectionStatsBuddy,
  AdminReflectionStatsPlace,
  AdminReflectionStatsResponse,
  AdminReflectionStatsRow,
} from '@peace-buddy/types'
import { MemberTypeSchema, REFLECTION_PROMPTS } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { apiClient } from '@/lib/api-client'
import { placeName } from '@/lib/place-names'
import type { ActionResult } from '../../../../../lib/action'
import { classifyApiError } from '../../../../../lib/api-error'
import { ASC } from '../../../../../lib/constants'
import { emptyStatsScope, type StatsScope } from '../_components/scope-fields'
import { nextMonth, ratio } from '../stats-helpers'

// Server-side scope, plus the one tour the tour detail page links to.
export type ReflectionStatsScope = StatsScope & { tourId: string }

export const emptyReflectionStatsScope: ReflectionStatsScope = { ...emptyStatsScope, tourId: '' }

// A moment with no spot — a free-text note, or the place name a spot-less
// place's form fills in — is counted under its session's place.
export const NO_SPOT = 'none'

export function spotKey(placeId: string, spotId: string | null): string {
  return spotId ?? `${NO_SPOT}:${placeId}`
}

// Client-side row filters. PLAB members are left out by default, as on the
// buddy stats page, so the two reflection rates agree.
export type ReflectionStatsFilters = {
  buddy: string
  text: string
  spot: string
  openQuestionsOnly: boolean
  includePlabMembers: boolean
}

export const defaultReflectionStatsFilters: ReflectionStatsFilters = {
  buddy: '',
  text: '',
  spot: '',
  openQuestionsOnly: false,
  includePlabMembers: false,
}

type BuddyFields = { displayName: string; realName: string; memberType: string }

function matchesBuddy(buddy: BuddyFields, filters: ReflectionStatsFilters): boolean {
  if (!filters.includePlabMembers && buddy.memberType === MemberTypeSchema.enum.plab_member) return false
  const search = filters.buddy.trim().toLowerCase()
  return !search || `${buddy.displayName} ${buddy.realName}`.toLowerCase().includes(search)
}

function rowBuddy(row: AdminReflectionStatsRow): BuddyFields {
  return { displayName: row.buddyDisplayName, realName: row.buddyRealName, memberType: row.buddyMemberType }
}

// Every word a buddy wrote: the four prompts, each moment and its own note.
function reflectionText(row: AdminReflectionStatsRow): string {
  return [
    ...REFLECTION_PROMPTS.map((key) => row[key] ?? ''),
    ...row.moments.flatMap((m) => [m.description, m.placeNote ?? '']),
  ]
    .join('\n')
    .toLowerCase()
}

// The rows the buddy filters keep, before spot, text and question filters —
// what the reflection rate divides.
export function filterByBuddy<T extends AdminReflectionStatsRow | AdminReflectionStatsBuddy>(
  rows: T[],
  filters: ReflectionStatsFilters,
): T[] {
  return rows.filter((row) => matchesBuddy('buddyDisplayName' in row ? rowBuddy(row) : row, filters))
}

export function filterReflections(
  rows: AdminReflectionStatsRow[],
  filters: ReflectionStatsFilters,
): AdminReflectionStatsRow[] {
  const text = filters.text.trim().toLowerCase()
  return filterByBuddy(rows, filters).filter((row) => {
    if (filters.openQuestionsOnly && !row.openQuestions?.trim()) return false
    if (filters.spot && !row.moments.some((m) => spotKey(row.place.id, m.spotId) === filters.spot)) return false
    if (text && !reflectionText(row).includes(text)) return false
    return true
  })
}

// Clicking a bar narrows the list to the reflections behind it.
export type ReflectionFocus = { label: string; match: (row: AdminReflectionStatsRow) => boolean }

export type ReflectionBucket = { id: string; value: number; match: (row: AdminReflectionStatsRow) => boolean }

export type SpotGroup = { place: AdminReflectionStatsPlace; bars: ReflectionBucket[] }

export type ReflectionOverview = {
  reflections: number
  buddiesWrote: number
  moments: number
  reflectionRate: number | null
  spots: SpotGroup[]
  places: ReflectionBucket[]
  months: ReflectionBucket[]
}

function monthOf(row: AdminReflectionStatsRow): string {
  // `tourDate` is a calendar date at UTC midnight; its first seven characters are its month.
  return row.tourDate.slice(0, 7)
}

const largestFirst = (a: ReflectionBucket, b: ReflectionBucket) => b.value - a.value

// Moments per spot, one group per place that has spots, largest first. An
// active spot nobody wrote about shows as zero; a retired one only while a
// moment names it. Moments without a spot at that place close the group.
function spotGroups(rows: AdminReflectionStatsRow[], places: AdminReflectionStatsPlace[]): SpotGroup[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const m of row.moments) {
      const key = spotKey(row.place.id, m.spotId)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const bucket = (key: string): ReflectionBucket => ({
    id: key,
    value: counts.get(key) ?? 0,
    match: (row) => row.moments.some((m) => spotKey(row.place.id, m.spotId) === key),
  })
  return places
    .filter((place) => place.spots.length > 0)
    .map((place) => {
      const spots = place.spots
        .filter((spot) => spot.active || counts.has(spot.id))
        .map((spot) => bucket(spot.id))
        .sort(largestFirst)
      const other = bucket(spotKey(place.id, null))
      return { place, bars: other.value > 0 ? [...spots, other] : spots }
    })
    .filter((group) => group.place.active || group.bars.some((b) => b.value > 0))
}

// Moments per session place, largest first; an active place with none shows as zero.
function placeBuckets(rows: AdminReflectionStatsRow[], places: AdminReflectionStatsPlace[]): ReflectionBucket[] {
  return places
    .map((place) => ({
      id: place.id,
      value: rows.filter((r) => r.place.id === place.id).reduce((n, r) => n + r.moments.length, 0),
      match: (row: AdminReflectionStatsRow) => row.place.id === place.id,
    }))
    .filter((b) => b.value > 0 || places.find((p) => p.id === b.id)?.active)
    .sort(largestFirst)
}

// Reflections per tour month, every month from the first to the last in view.
function monthBuckets(rows: AdminReflectionStatsRow[]): ReflectionBucket[] {
  if (rows.length === 0) return []
  const months = rows.map(monthOf).sort()
  const buckets: ReflectionBucket[] = []
  for (let month = months[0]; month <= months[months.length - 1]; month = nextMonth(month)) {
    const key = month
    buckets.push({ id: key, value: months.filter((m) => m === key).length, match: (row) => monthOf(row) === key })
  }
  return buckets
}

// `rows` are the reflections the list shows. The rate reads `rateRows` and
// `rateBuddies` instead — the buddy filters only — since dividing reflections
// about one spot by every session attended would mean nothing.
export function buildReflectionOverview(
  rows: AdminReflectionStatsRow[],
  places: AdminReflectionStatsPlace[],
  rateRows: AdminReflectionStatsRow[],
  rateBuddies: AdminReflectionStatsBuddy[],
): ReflectionOverview {
  return {
    reflections: rows.length,
    buddiesWrote: new Set(rows.map((r) => r.buddyId)).size,
    moments: rows.reduce((n, r) => n + r.moments.length, 0),
    reflectionRate: ratio(rateRows.length, rateBuddies.reduce((n, b) => n + b.sessionsAttended, 0)),
    spots: spotGroups(rows, places),
    places: placeBuckets(rows, places),
    months: monthBuckets(rows),
  }
}

export type ReflectionSortField = 'tourDate' | 'group' | 'session' | 'buddy' | 'place' | 'submittedAt'

export function sortReflections(
  rows: AdminReflectionStatsRow[],
  field: ReflectionSortField,
  dir: SortDir,
  locale: string,
): AdminReflectionStatsRow[] {
  const text = (a: string, b: string) => a.localeCompare(b, locale)
  return [...rows].sort((a, b) => {
    let cmp = 0
    if (field === 'tourDate') cmp = a.tourDate.localeCompare(b.tourDate)
    else if (field === 'group') cmp = text(a.group.name, b.group.name)
    else if (field === 'session') cmp = a.sessionOrder - b.sessionOrder
    else if (field === 'buddy') cmp = text(a.buddyDisplayName, b.buddyDisplayName)
    else if (field === 'place') cmp = text(placeName(a.place, locale), placeName(b.place, locale))
    else cmp = a.createdAt.localeCompare(b.createdAt)
    // Ties fall back to submission time.
    if (cmp === 0) cmp = a.createdAt.localeCompare(b.createdAt)
    return dir === ASC ? cmp : -cmp
  })
}

export async function fetchReflectionStats(
  scope: ReflectionStatsScope,
): Promise<ActionResult<AdminReflectionStatsResponse>> {
  try {
    return {
      ok: true,
      data: await apiClient.listReflectionStats({
        from: scope.from || undefined,
        to: scope.to || undefined,
        groupType: scope.groupType || undefined,
        placeId: scope.placeId || undefined,
        tourId: scope.tourId || undefined,
      }),
    }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
