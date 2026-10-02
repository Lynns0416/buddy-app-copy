import type {
  AdminBuddyStatsResponse,
  AdminBuddyStatsRow,
  BuddyStatus,
  BuddyTier,
  GroupType,
  MemberType,
  PlaceSummary,
} from '@peace-buddy/types'
import {
  BuddyStatusSchema,
  BuddyTierSchema,
  CancellationCategorySchema,
  EVALUATION_SCORE_FIELDS,
  GroupTypeSchema,
  MemberTypeSchema,
} from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'
import { placeName } from '@/lib/place-names'
import { getBuddyStatusLabel, getBuddyTierLabel, getGroupTypeLabel } from '@/lib/status-display'
import { memberTypeLabelKey } from '../../buddies/admin.buddy'
import { emptyStatsScope, type StatsScope } from '../_components/scope-fields'
import type { ActionResult } from '../../../../../lib/action'
import { classifyApiError } from '../../../../../lib/api-error'
import { ASC, DESC } from '../../../../../lib/constants'

// Server-side scope: every number counts only tours inside it (PRD §11.4).
export type BuddyStatsScope = StatsScope

export const emptyBuddyStatsScope: BuddyStatsScope = emptyStatsScope

// Client-side row filters. Active buddies only and PLAB members left out by
// default: the page is about part-time buddies, and PLAB members would skew every ranking.
export type BuddyStatsFilters = {
  search: string
  statuses: BuddyStatus[]
  tiers: BuddyTier[]
  includePlabMembers: boolean
}

export const defaultBuddyStatsFilters: BuddyStatsFilters = {
  search: '',
  statuses: [BuddyStatusSchema.enum.active],
  tiers: [],
  includePlabMembers: false,
}

export function filterBuddyStats(rows: AdminBuddyStatsRow[], filters: BuddyStatsFilters): AdminBuddyStatsRow[] {
  const search = filters.search.trim().toLowerCase()
  return rows.filter((row) => {
    if (!filters.includePlabMembers && row.memberType === MemberTypeSchema.enum.plab_member) return false
    if (filters.statuses.length > 0 && !filters.statuses.includes(row.status)) return false
    if (filters.tiers.length > 0 && (!row.tier || !filters.tiers.includes(row.tier))) return false
    if (search && !`${row.displayName} ${row.realName}`.toLowerCase().includes(search)) return false
    return true
  })
}

export type StatGroup = 'profile' | 'participation' | 'cancellations' | 'engagement' | 'evaluations' | 'coverage'
export const STAT_GROUPS: StatGroup[] = ['profile', 'participation', 'cancellations', 'engagement', 'evaluations', 'coverage']

// Numbers format by kind; the three profile enums read through their own labels.
export type StatFormat = 'count' | 'rate' | 'score' | 'hours' | 'date' | 'status' | 'tier' | 'memberType'

const TEXT_FORMATS: StatFormat[] = ['status', 'tier', 'memberType']

// How a column names itself: a key in `adminBuddyStats.columns`, optionally
// with one value the page resolves (a criterion, category, group type or place).
export type StatLabel =
  | { key: string }
  | { key: string; score: (typeof EVALUATION_SCORE_FIELDS)[number] }
  | { key: string; category: (typeof CancellationCategorySchema.options)[number] }
  | { key: string; groupType: GroupType }
  | { key: string; place: PlaceSummary }

type CellValue = number | string | null

export type StatColumn = {
  id: string
  group: StatGroup
  label: StatLabel
  format: StatFormat
  defaultVisible: boolean
  value: (row: AdminBuddyStatsRow) => CellValue
  // Sort key when it differs from the value (tier and status sort by rank).
  sortValue?: (row: AdminBuddyStatsRow) => CellValue
}

function column(
  id: string,
  group: StatGroup,
  format: StatFormat,
  value: StatColumn['value'],
  defaultVisible = false,
): StatColumn {
  return { id, group, label: { key: id }, format, defaultVisible, value }
}

// Every column the page can show, in picker order. Ids are stable: the column
// choice is saved under them.
export function buildStatColumns(places: PlaceSummary[]): StatColumn[] {
  return [
    {
      ...column('status', 'profile', 'status', (r) => r.status),
      sortValue: (r) => BuddyStatusSchema.options.indexOf(r.status),
    },
    {
      ...column('tier', 'profile', 'tier', (r) => r.tier, true),
      sortValue: (r) => (r.tier ? BuddyTierSchema.options.indexOf(r.tier) : null),
    },
    {
      ...column('memberType', 'profile', 'memberType', (r) => r.memberType),
      sortValue: (r) => MemberTypeSchema.options.indexOf(r.memberType),
    },
    column('createdAt', 'profile', 'date', (r) => r.createdAt),
    column('monthsSinceRegistration', 'profile', 'count', (r) => r.stats.monthsSinceRegistration),

    column('sessionsAttended', 'participation', 'count', (r) => r.stats.sessionsAttended, true),
    column('toursAttended', 'participation', 'count', (r) => r.stats.toursAttended, true),
    column('noShows', 'participation', 'count', (r) => r.stats.noShows, true),
    column('lateUnexcused', 'participation', 'count', (r) => r.stats.lateUnexcused, true),
    column('attendanceRate', 'participation', 'rate', (r) => r.stats.attendanceRate, true),
    column('upcomingConfirmed', 'participation', 'count', (r) => r.stats.upcomingConfirmed, true),
    column('openMaybe', 'participation', 'count', (r) => r.stats.openMaybe),
    column('openWaitlist', 'participation', 'count', (r) => r.stats.openWaitlist),
    column('firstTourDate', 'participation', 'date', (r) => r.stats.firstTourDate),
    column('lastTourDate', 'participation', 'date', (r) => r.stats.lastTourDate, true),
    column('daysSinceLastTour', 'participation', 'count', (r) => r.stats.daysSinceLastTour, true),
    column('hoursOnTour', 'participation', 'hours', (r) => r.stats.minutesOnTour),
    column('sessionsWithoutTimes', 'participation', 'count', (r) => r.stats.sessionsWithoutTimes),

    column('bookings', 'cancellations', 'count', (r) => r.stats.bookings),
    column('cancellations', 'cancellations', 'count', (r) => r.stats.cancellations, true),
    column('lateCancellations', 'cancellations', 'count', (r) => r.stats.lateCancellations, true),
    column('cancellationRate', 'cancellations', 'rate', (r) => r.stats.cancellationRate),
    column('cancellationsUnavoidable', 'cancellations', 'count', (r) => r.stats.cancellationsUnavoidable),
    column('cancellationsAvoidable', 'cancellations', 'count', (r) => r.stats.cancellationsAvoidable),
    column('cancellationsUnreviewed', 'cancellations', 'count', (r) => r.stats.cancellationsUnreviewed),
    ...CancellationCategorySchema.options.map((category) => ({
      ...column(`cancellations.${category}`, 'cancellations', 'count', (r) => r.stats.cancellationsByCategory[category]),
      label: { key: 'cancellationsByCategory', category },
    })),

    column('reflections', 'engagement', 'count', (r) => r.stats.reflections, true),
    column('reflectionRate', 'engagement', 'rate', (r) => r.stats.reflectionRate),
    column('moments', 'engagement', 'count', (r) => r.stats.moments),

    column('evaluationsReceived', 'evaluations', 'count', (r) => r.stats.evaluationsReceived),
    column('evaluationsMissing', 'evaluations', 'count', (r) => r.stats.evaluationsMissing),
    ...EVALUATION_SCORE_FIELDS.map((score) => ({
      ...column(`averageScore.${score}`, 'evaluations', 'score', (r) => r.stats.averageScores[score]),
      label: { key: 'averageScore', score },
    })),
    column('profileOverallRating', 'evaluations', 'score', (r) => r.stats.profileOverallRating),

    column('placesGuided', 'coverage', 'count', (r) => r.stats.placesGuided),
    ...places.map((place) => ({
      ...column(`place.${place.id}`, 'coverage', 'count', (r) => r.stats.sessionsByPlace[place.id] ?? 0),
      label: { key: 'sessionsAtPlace', place },
    })),
    column('groupTypesServed', 'coverage', 'count', (r) => r.stats.groupTypesServed),
    ...GroupTypeSchema.options.map((groupType) => ({
      ...column(`groupType.${groupType}`, 'coverage', 'count', (r) => r.stats.sessionsByGroupType[groupType]),
      label: { key: 'sessionsForGroupType', groupType },
    })),
  ]
}

export function defaultVisibleColumns(columns: StatColumn[]): string[] {
  return columns.filter((c) => c.defaultVisible).map((c) => c.id)
}

type TFn = (key: string, values?: Record<string, string>) => string

// adminBuddyStats, adminEvaluations, adminBuddies, groupType, buddyStatus, buddyTier.
export type StatTranslators = {
  t: TFn
  tEval: TFn
  tBuddies: TFn
  tGroupType: TFn
  tStatus: TFn
  tTier: TFn
}

export function statLabel(label: StatLabel, tr: StatTranslators, locale: string): string {
  const key = `columns.${label.key}`
  if ('score' in label) return tr.t(key, { criterion: tr.tEval(`fields.${label.score}`) })
  if ('category' in label) return tr.t(key, { category: tr.tBuddies(`cancelCategory.${label.category}`) })
  if ('groupType' in label) return tr.t(key, { groupType: getGroupTypeLabel(tr.tGroupType, label.groupType) })
  if ('place' in label) return tr.t(key, { place: placeName(label.place, locale) })
  return tr.t(key)
}

// Columns whose name alone does not say what is counted or divided by. Keyed by
// label key, so one description covers every criterion of `averageScore`.
const DESCRIBED_STATS = new Set([
  'sessionsAttended',
  'toursAttended',
  'lateUnexcused',
  'attendanceRate',
  'openMaybe',
  'hoursOnTour',
  'sessionsWithoutTimes',
  'lateCancellations',
  'cancellationRate',
  'cancellationsUnavoidable',
  'cancellationsAvoidable',
  'cancellationsUnreviewed',
  'evaluationsMissing',
  'moments',
  'averageScore',
])

export function statDescription(labelKey: string, tr: StatTranslators): string | null {
  return DESCRIBED_STATS.has(labelKey) ? tr.t(`descriptions.${labelKey}`) : null
}

// '—' for a number there is nothing to compute from (no sessions to divide by,
// no scores given), so it never reads as a zero.
export function formatStat(column: StatColumn, row: AdminBuddyStatsRow, tr: StatTranslators): string {
  const value = column.value(row)
  if (value === null) return '—'
  switch (column.format) {
    case 'status':     return getBuddyStatusLabel(tr.tStatus, value as BuddyStatus)
    case 'tier':       return getBuddyTierLabel(tr.tTier, value as BuddyTier)
    case 'memberType': return tr.tBuddies(memberTypeLabelKey(value as MemberType))
    case 'date':       return formatDate(String(value))
    case 'rate':       return `${Math.round(Number(value) * 100)}%`
    case 'score':      return Number(value).toFixed(1)
    case 'hours':      return (Number(value) / 60).toFixed(1)
    default:           return String(value)
  }
}

export type StatSortField = string

// Nulls sort last in both directions: a buddy with nothing to show should not
// top a ranking either way.
export function sortBuddyStats(
  rows: AdminBuddyStatsRow[],
  columns: StatColumn[],
  field: StatSortField,
  dir: SortDir,
): AdminBuddyStatsRow[] {
  const col = columns.find((c) => c.id === field)
  const key = (row: AdminBuddyStatsRow): CellValue =>
    field === 'displayName' ? row.displayName : col ? (col.sortValue ?? col.value)(row) : null
  return [...rows].sort((a, b) => {
    const va = key(a)
    const vb = key(b)
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), routing.defaultLocale)
    return dir === ASC ? cmp : -cmp
  })
}

// Counts read best largest first, so a new stat column starts descending;
// the name column starts ascending like every other roster.
export function nextStatSort(
  current: { field: StatSortField; dir: SortDir },
  clicked: StatSortField,
  columns: StatColumn[],
): { field: StatSortField; dir: SortDir } {
  if (clicked === current.field) return { field: clicked, dir: current.dir === ASC ? DESC : ASC }
  const format = columns.find((c) => c.id === clicked)?.format
  return { field: clicked, dir: format === undefined || TEXT_FORMATS.includes(format) ? ASC : DESC }
}

const COLUMNS_STORAGE_KEY = 'adminBuddyStats.columns'

// The column choice is a per-admin convenience kept in this browser; storage
// can be missing or throw (private windows), so it falls back to the default.
export function loadVisibleColumns(fallback: string[]): string[] {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((v) => typeof v === 'string') ? parsed : fallback
  } catch {
    return fallback
  }
}

export function saveVisibleColumns(ids: string[]): void {
  try {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Not saved; the choice still holds for this visit.
  }
}

export async function fetchBuddyStats(scope: BuddyStatsScope): Promise<ActionResult<AdminBuddyStatsResponse>> {
  try {
    return {
      ok: true,
      data: await apiClient.listBuddyStats({
        from: scope.from || undefined,
        to: scope.to || undefined,
        groupType: scope.groupType || undefined,
        placeId: scope.placeId || undefined,
      }),
    }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
