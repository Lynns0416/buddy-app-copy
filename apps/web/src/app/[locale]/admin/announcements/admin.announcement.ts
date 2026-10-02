import type {
  AdminAnnouncementResponse,
  AdminBuddyResponse,
  AnnouncementAudienceInput,
  AnnouncementBuddyStatus,
  BuddyTier,
  UpsertAnnouncement,
} from '@peace-buddy/types'
import { AnnouncementAudienceSchema, AnnouncementBuddyStatusSchema } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../../lib/action'
import { classifyApiError } from '../../../../lib/api-error'
import { ASC, DESC } from '../../../../lib/constants'

// ── State ──────────────────────────────────────────────────────────────────

export type AnnouncementState = 'scheduled' | 'showing' | 'ended'

const STATE_ORDER: AnnouncementState[] = ['showing', 'scheduled', 'ended']

/** By its dates alone: a tour-linked one may still be hidden from some or all buddies. */
export function announcementState(a: Pick<AdminAnnouncementResponse, 'startDate' | 'endDate'>, today: string): AnnouncementState {
  if (a.startDate > today) return 'scheduled'
  if (a.endDate < today) return 'ended'
  return 'showing'
}

// ── Sort ───────────────────────────────────────────────────────────────────

export type AnnouncementSortField = 'position' | 'title' | 'audience' | 'period' | 'tour' | 'author' | 'state'

export function sortAnnouncements(
  list: AdminAnnouncementResponse[],
  field: AnnouncementSortField,
  dir: SortDir,
  ctx: { today: string; audienceLabel: (a: AdminAnnouncementResponse) => string },
): AdminAnnouncementResponse[] {
  const text = (a: string, b: string) => a.localeCompare(b, routing.defaultLocale)
  return [...list].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'position': cmp = a.position - b.position; break
      case 'title':    cmp = text(a.titleJa, b.titleJa); break
      case 'audience': cmp = text(ctx.audienceLabel(a), ctx.audienceLabel(b)); break
      case 'period':   cmp = a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate); break
      case 'tour':     cmp = (a.tour?.tourDate ?? '').localeCompare(b.tour?.tourDate ?? ''); break
      case 'author':   cmp = text(a.createdBy.name, b.createdBy.name); break
      case 'state':
        cmp = STATE_ORDER.indexOf(announcementState(a, ctx.today)) - STATE_ORDER.indexOf(announcementState(b, ctx.today))
        break
    }
    // Ties keep the members' order.
    return (dir === ASC ? cmp : -cmp) || a.position - b.position
  })
}

export function nextAnnouncementSort(
  current: { field: AnnouncementSortField; dir: SortDir },
  clicked: AnnouncementSortField,
): { field: AnnouncementSortField; dir: SortDir } {
  if (clicked === current.field) return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  return { field: clicked, dir: ASC }
}

/** The ids in members' order with one moved up (-1) or down (+1); null at either end. */
export function moveAnnouncement(ordered: AdminAnnouncementResponse[], id: string, delta: -1 | 1): string[] | null {
  const ids = ordered.map((a) => a.id)
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return null
  ;[ids[from], ids[to]] = [ids[to], ids[from]]
  return ids
}

// ── Form ───────────────────────────────────────────────────────────────────

export type AnnouncementFormValues = {
  titleJa: string
  bodyJa: string
  titleEn: string
  bodyEn: string
  audience: AnnouncementAudienceInput['audience']
  statuses: AnnouncementBuddyStatus[]
  tiers: BuddyTier[]
  buddyIds: string[]
  startDate: string
  endDate: string
  tourId: string
}

export function emptyAnnouncementForm(today: string): AnnouncementFormValues {
  return {
    titleJa: '',
    bodyJa: '',
    titleEn: '',
    bodyEn: '',
    audience: AnnouncementAudienceSchema.enum.rule,
    statuses: [],
    tiers: [],
    buddyIds: [],
    startDate: today,
    endDate: '',
    tourId: '',
  }
}

export function announcementFormFrom(a: AdminAnnouncementResponse): AnnouncementFormValues {
  return {
    titleJa: a.titleJa,
    bodyJa: a.bodyJa,
    titleEn: a.titleEn ?? '',
    bodyEn: a.bodyEn ?? '',
    audience: a.audience,
    statuses: a.statuses,
    tiers: a.tiers,
    buddyIds: a.buddies.map((b) => b.id),
    startDate: a.startDate,
    endDate: a.endDate,
    tourId: a.tour?.id ?? '',
  }
}

// Message keys under `adminAnnouncements.form.error`.
export type AnnouncementFormError = 'endBeforeStart' | 'enPair' | 'noBuddies'

export function validateAnnouncementForm(v: AnnouncementFormValues): AnnouncementFormError[] {
  const errors: AnnouncementFormError[] = []
  if (v.startDate && v.endDate && v.endDate < v.startDate) errors.push('endBeforeStart')
  if ((v.titleEn.trim() === '') !== (v.bodyEn.trim() === '')) errors.push('enPair')
  if (v.audience === AnnouncementAudienceSchema.enum.selected && v.buddyIds.length === 0) errors.push('noBuddies')
  return errors
}

export function toUpsertAnnouncement(v: AnnouncementFormValues): UpsertAnnouncement {
  return {
    titleJa: v.titleJa.trim(),
    bodyJa: v.bodyJa.trim(),
    titleEn: v.titleEn.trim() || null,
    bodyEn: v.bodyEn.trim() || null,
    ...audienceInput(v),
    startDate: v.startDate,
    endDate: v.endDate,
    tourId: v.tourId || null,
  }
}

export function audienceInput(v: Pick<AnnouncementFormValues, 'audience' | 'statuses' | 'tiers' | 'buddyIds'>): AnnouncementAudienceInput {
  return { audience: v.audience, statuses: v.statuses, tiers: v.tiers, buddyIds: v.buddyIds }
}

/** A tier in the rule leaves out every buddy without one, which is every trainee. */
export function ruleExcludesTrainees(v: Pick<AnnouncementFormValues, 'audience' | 'statuses' | 'tiers'>): boolean {
  return (
    v.audience === AnnouncementAudienceSchema.enum.rule &&
    v.tiers.length > 0 &&
    (v.statuses.length === 0 || v.statuses.includes(AnnouncementBuddyStatusSchema.enum.trainee))
  )
}

// Buddies a member can pick: only those who reach Home.
export function pickableBuddies(buddies: AdminBuddyResponse[]): AdminBuddyResponse[] {
  const statuses: string[] = AnnouncementBuddyStatusSchema.options
  return buddies.filter((b) => statuses.includes(b.status))
}

export function buddyPickLabel(b: Pick<AdminBuddyResponse, 'displayName' | 'realName'>): string {
  return b.realName ? `${b.realName} (${b.displayName})` : b.displayName
}

// ── API ────────────────────────────────────────────────────────────────────

async function run<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await call() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export const fetchAnnouncements = () => run(() => apiClient.listAnnouncements())
export const fetchAnnouncement = (id: string) => run(() => apiClient.getAnnouncement(id))
export const createAnnouncement = (data: UpsertAnnouncement) => run(() => apiClient.createAnnouncement(data))
export const updateAnnouncement = (id: string, data: UpsertAnnouncement) => run(() => apiClient.updateAnnouncement(id, data))
export const deleteAnnouncement = (id: string) => run(() => apiClient.deleteAnnouncement(id))
export const reorderAnnouncements = (ids: string[]) => run(() => apiClient.reorderAnnouncements(ids))
export const countAnnouncementAudience = (input: AnnouncementAudienceInput) =>
  run(() => apiClient.countAnnouncementAudience(input))
