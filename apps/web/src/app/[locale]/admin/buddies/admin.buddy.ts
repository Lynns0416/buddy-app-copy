import type { AdminBuddyResponse, AdminBuddyDetailResponse, AdminBuddyBookingEntry, BuddyStatus, BuddyTier, MemberType, UpdateAdminBuddyProfile, AppError, CancellationReasonResponse, BookingStatus, AdminBookingStatusResponse } from '@peace-buddy/types'
import { AppErrorCodeSchema, BuddyStatusSchema, BuddyTierSchema, MemberTypeSchema } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../../lib/action'
import { classifyApiError } from '../../../../lib/api-error'
import { ASC, DESC } from '../../../../lib/constants'

export type BuddySortField = 'displayName' | 'email' | 'tier' | 'memberType'

// Tiers sort by the order they are declared in BuddyTierSchema — junior first,
// blackstar last — not alphabetically. Null (trainees and unpromoted buddies)
// sorts before every tier.
function tierRank(tier: BuddyTier | null): number {
  if (!tier) return -1
  return BuddyTierSchema.options.indexOf(tier)
}

// memberType sorts by declaration order too — buddy before plab_member — so the
// column groups the roster by employment rather than by label spelling.
function memberTypeRank(memberType: MemberType): number {
  return MemberTypeSchema.options.indexOf(memberType)
}

// `plab_member` does not camel-case into a message key on its own, and a
// Record keyed by MemberType makes a new enum value a type error here rather
// than a missing translation at runtime.
const MEMBER_TYPE_LABEL_KEY: Record<MemberType, string> = {
  [MemberTypeSchema.enum.buddy]: 'memberTypeBuddy',
  [MemberTypeSchema.enum.plab_member]: 'memberTypePlabMember',
}

export function memberTypeLabelKey(memberType: MemberType): string {
  return MEMBER_TYPE_LABEL_KEY[memberType]
}

export function mapBuddyError(t: (key: string) => string, error: AppError): string {
  switch (error.code) {
    case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
    case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
    case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
    case AppErrorCodeSchema.enum.network:    return t('error.network')
    default:                                 return t('error.unknown')
  }
}

export function buddyName(
  t: (key: string, values?: Record<string, string>) => string,
  buddy: { displayName: string; realName: string },
): string {
  if (!buddy.realName) return buddy.displayName
  return t('nameWithReal', { displayName: buddy.displayName, realName: buddy.realName })
}

export function sortBuddies(
  buddies: AdminBuddyResponse[],
  field: BuddySortField,
  dir: SortDir,
): AdminBuddyResponse[] {
  return [...buddies].sort((a, b) => {
    let cmp = 0
    if (field === 'displayName') {
      cmp = a.displayName.localeCompare(b.displayName, routing.defaultLocale)
    } else if (field === 'email') {
      cmp = a.email.localeCompare(b.email)
    } else if (field === 'tier') {
      cmp = tierRank(a.tier) - tierRank(b.tier)
    } else if (field === 'memberType') {
      cmp = memberTypeRank(a.memberType) - memberTypeRank(b.memberType)
    }
    return dir === ASC ? cmp : -cmp
  })
}

export function nextBuddySort(
  current: { field: BuddySortField; dir: SortDir },
  clicked: BuddySortField,
): { field: BuddySortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export async function fetchBuddies(status: BuddyStatus, tier?: BuddyTier, memberType?: MemberType): Promise<ActionResult<AdminBuddyResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listBuddies(status, tier, memberType) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchTrainees(): Promise<ActionResult<AdminBuddyResponse[]>> {
  return fetchBuddies(BuddyStatusSchema.enum.trainee)
}

export async function updateBuddyStatus(id: string, status: BuddyStatus): Promise<ActionResult<void>> {
  try {
    await apiClient.updateBuddyStatus(id, { status })
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export type BookingHistorySortField = 'group' | 'tourDate' | 'status'

export function sortBookingHistory(
  bookings: AdminBuddyBookingEntry[],
  field: BookingHistorySortField,
  dir: SortDir,
): AdminBuddyBookingEntry[] {
  return [...bookings].sort((a, b) => {
    let cmp = 0
    if (field === 'group') {
      cmp = a.tour.group.name.localeCompare(b.tour.group.name)
    } else if (field === 'tourDate') {
      cmp = a.tour.tourDate.localeCompare(b.tour.tourDate)
    } else if (field === 'status') {
      cmp = a.status.localeCompare(b.status)
    }
    return dir === ASC ? cmp : -cmp
  })
}

export function nextBookingSort(
  current: { field: BookingHistorySortField; dir: SortDir },
  clicked: BookingHistorySortField,
): { field: BookingHistorySortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export async function fetchBuddy(id: string): Promise<ActionResult<AdminBuddyDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.getBuddy(id) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateBuddy(id: string, data: UpdateAdminBuddyProfile): Promise<ActionResult<AdminBuddyResponse>> {
  try {
    return { ok: true, data: await apiClient.updateBuddy(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateCancellationReason(bookingId: string, unavoidable: boolean | null): Promise<ActionResult<CancellationReasonResponse>> {
  try {
    return { ok: true, data: await apiClient.updateCancellationReason(bookingId, unavoidable) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<ActionResult<AdminBookingStatusResponse>> {
  try {
    return { ok: true, data: await apiClient.updateBookingStatus(bookingId, status) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
