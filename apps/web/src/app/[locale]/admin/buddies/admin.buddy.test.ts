import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortBuddies, nextBuddySort, buddyName, memberTypeLabelKey, fetchBuddies, fetchTrainees, updateBuddyStatus, fetchBuddy, updateBuddy, sortBookingHistory, nextBookingSort } from './admin.buddy'
import type { AdminBuddyResponse, AdminBuddyDetailResponse, AdminBuddyBookingEntry } from '@peace-buddy/types'
import { BuddyStatusSchema, BuddyTierSchema, MemberTypeSchema } from '@peace-buddy/types'

vi.mock('@/i18n/routing', () => ({
  routing: { defaultLocale: 'en' },
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listBuddies: vi.fn(),
    updateBuddyStatus: vi.fn(),
    getBuddy: vi.fn(),
    updateBuddy: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return { ApiError }
})

import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/lib/api'

const mockListBuddies = vi.mocked(apiClient.listBuddies)
const mockUpdateBuddyStatus = vi.mocked(apiClient.updateBuddyStatus)
const mockGetBuddy = vi.mocked(apiClient.getBuddy)
const mockUpdateBuddy = vi.mocked(apiClient.updateBuddy)

// ── sortBuddies ────────────────────────────────────────────────────────────

const buddy = (overrides: Partial<AdminBuddyResponse> = {}): AdminBuddyResponse => ({
  id: 'b1',
  userId: 'u1',
  displayName: 'Alice',
  email: 'alice@example.com',
  tier: null,
  memberType: 'buddy',
  status: 'pending',
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
} as AdminBuddyResponse)

const alice   = buddy({ id: 'b1', displayName: 'Alice',   email: 'alice@example.com',   tier: 'junior' })
const bob     = buddy({ id: 'b2', displayName: 'Bob',     email: 'bob@example.com',     tier: 'star' })
const charlie = buddy({ id: 'b3', displayName: 'Charlie', email: 'charlie@example.com', tier: 'buddy' })

describe('sortBuddies', () => {
  describe('by displayName', () => {
    it('sorts asc', () => {
      const result = sortBuddies([charlie, alice, bob], 'displayName', 'asc')
      expect(result.map((b) => b.displayName)).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('sorts desc', () => {
      const result = sortBuddies([charlie, alice, bob], 'displayName', 'desc')
      expect(result.map((b) => b.displayName)).toEqual(['Charlie', 'Bob', 'Alice'])
    })
  })

  describe('by email', () => {
    it('sorts asc', () => {
      const result = sortBuddies([charlie, alice, bob], 'email', 'asc')
      expect(result.map((b) => b.email)).toEqual(['alice@example.com', 'bob@example.com', 'charlie@example.com'])
    })

    it('sorts desc', () => {
      const result = sortBuddies([charlie, alice, bob], 'email', 'desc')
      expect(result.map((b) => b.email)).toEqual(['charlie@example.com', 'bob@example.com', 'alice@example.com'])
    })
  })

  it('does not mutate the original array', () => {
    const original = [charlie, alice, bob]
    sortBuddies(original, 'displayName', 'asc')
    expect(original.map((b) => b.id)).toEqual(['b3', 'b1', 'b2'])
  })

  describe('by tier', () => {
    it('sorts asc', () => {
      const result = sortBuddies([bob, alice, charlie], 'tier', 'asc')
      expect(result.map((b) => b.tier)).toEqual(['junior', 'buddy', 'star'])
    })

    it('sorts desc', () => {
      const result = sortBuddies([bob, alice, charlie], 'tier', 'desc')
      expect(result.map((b) => b.tier)).toEqual(['star', 'buddy', 'junior'])
    })

    it('orders by tier rank, not alphabetically', () => {
      const dave = buddy({ id: 'b5', displayName: 'Dave', email: 'dave@example.com', tier: 'blackstar' })
      const result = sortBuddies([dave, bob, alice, charlie], 'tier', 'asc')
      expect(result.map((b) => b.tier)).toEqual(['junior', 'buddy', 'star', 'blackstar'])
    })

    it('sorts null tier before every tier asc', () => {
      const noTier = buddy({ id: 'b4', tier: null })
      const result = sortBuddies([alice, noTier], 'tier', 'asc')
      expect(result[0].id).toBe('b4')
    })
  })

  describe('by memberType', () => {
    const plab = buddy({ id: 'b6', memberType: 'plab_member' })

    it('sorts buddy before plab_member asc', () => {
      const result = sortBuddies([plab, alice], 'memberType', 'asc')
      expect(result.map((b) => b.id)).toEqual(['b1', 'b6'])
    })

    it('sorts plab_member first desc', () => {
      const result = sortBuddies([alice, plab], 'memberType', 'desc')
      expect(result.map((b) => b.id)).toEqual(['b6', 'b1'])
    })

    it('is independent of tier', () => {
      const plabJunior = buddy({ id: 'b7', tier: 'junior', memberType: 'plab_member' })
      const buddyBlackstar = buddy({ id: 'b8', tier: 'blackstar', memberType: 'buddy' })
      const result = sortBuddies([plabJunior, buddyBlackstar], 'memberType', 'asc')
      expect(result.map((b) => b.id)).toEqual(['b8', 'b7'])
    })
  })

  it('returns empty array unchanged', () => {
    expect(sortBuddies([], 'displayName', 'asc')).toEqual([])
  })
})

// ── memberTypeLabelKey ─────────────────────────────────────────────────────

describe('memberTypeLabelKey', () => {
  it('maps buddy to its message key', () => {
    expect(memberTypeLabelKey(MemberTypeSchema.enum.buddy)).toBe('memberTypeBuddy')
  })

  it('maps plab_member to its message key', () => {
    expect(memberTypeLabelKey(MemberTypeSchema.enum.plab_member)).toBe('memberTypePlabMember')
  })

  it('has a key for every member type', () => {
    for (const memberType of MemberTypeSchema.options) {
      expect(memberTypeLabelKey(memberType)).toBeTruthy()
    }
  })
})

// ── nextBuddySort ──────────────────────────────────────────────────────────

describe('nextBuddySort', () => {
  it('toggles asc → desc when clicking the active field', () => {
    const result = nextBuddySort({ field: 'displayName', dir: 'asc' }, 'displayName')
    expect(result).toEqual({ field: 'displayName', dir: 'desc' })
  })

  it('toggles desc → asc when clicking the active field', () => {
    const result = nextBuddySort({ field: 'email', dir: 'desc' }, 'email')
    expect(result).toEqual({ field: 'email', dir: 'asc' })
  })

  it('switches field and resets dir to asc', () => {
    const result = nextBuddySort({ field: 'displayName', dir: 'desc' }, 'email')
    expect(result).toEqual({ field: 'email', dir: 'asc' })
  })
})

// ── sortBookingHistory ─────────────────────────────────────────────────────

const booking = (overrides: {
  id?: string
  groupName?: string
  tourDate?: string
  status?: 'confirmed' | 'maybe' | 'waitlist' | 'declined'
} = {}): AdminBuddyBookingEntry => ({
  id: overrides.id ?? 'bk1',
  tourId: 't1',
  sessionId: 's1',
  sessionOrder: 1,
  sessionLabel: null,
  status: overrides.status ?? 'confirmed',
  bookedAt: '2026-01-01T00:00:00Z',
  cancellationReason: null,
  tour: {
    tourDate: overrides.tourDate ?? '2026-05-01T00:00:00.000Z',
    places: [{ id: 'place-1', nameJa: 'ホール', nameEn: 'Hall' }],
    group: { name: overrides.groupName ?? 'Group A' },
    status: 'published',
  },
})

const bk1 = booking({ id: 'bk1', groupName: 'Alpha',   tourDate: '2026-05-01T00:00:00.000Z', status: 'confirmed' })
const bk2 = booking({ id: 'bk2', groupName: 'Bravo',   tourDate: '2026-04-01T00:00:00.000Z', status: 'declined' })
const bk3 = booking({ id: 'bk3', groupName: 'Charlie', tourDate: '2026-06-01T00:00:00.000Z', status: 'maybe' })

describe('sortBookingHistory', () => {
  it('sorts by group name asc', () => {
    const result = sortBookingHistory([bk3, bk1, bk2], 'group', 'asc')
    expect(result.map((b) => b.tour.group.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('sorts by group name desc', () => {
    const result = sortBookingHistory([bk1, bk3, bk2], 'group', 'desc')
    expect(result.map((b) => b.tour.group.name)).toEqual(['Charlie', 'Bravo', 'Alpha'])
  })

  it('sorts by tour date asc (chronological)', () => {
    const result = sortBookingHistory([bk1, bk3, bk2], 'tourDate', 'asc')
    expect(result.map((b) => b.id)).toEqual(['bk2', 'bk1', 'bk3'])
  })

  it('sorts by tour date desc (most recent first)', () => {
    const result = sortBookingHistory([bk1, bk2, bk3], 'tourDate', 'desc')
    expect(result.map((b) => b.id)).toEqual(['bk3', 'bk1', 'bk2'])
  })

  it('sorts by status asc (alphabetical)', () => {
    const result = sortBookingHistory([bk3, bk1, bk2], 'status', 'asc')
    expect(result.map((b) => b.status)).toEqual(['confirmed', 'declined', 'maybe'])
  })

  it('sorts by status desc', () => {
    const result = sortBookingHistory([bk1, bk2, bk3], 'status', 'desc')
    expect(result.map((b) => b.status)).toEqual(['maybe', 'declined', 'confirmed'])
  })

  it('does not mutate the original array', () => {
    const original = [bk3, bk1, bk2]
    sortBookingHistory(original, 'tourDate', 'asc')
    expect(original.map((b) => b.id)).toEqual(['bk3', 'bk1', 'bk2'])
  })

  it('returns empty array unchanged', () => {
    expect(sortBookingHistory([], 'tourDate', 'desc')).toEqual([])
  })
})

// ── nextBookingSort ────────────────────────────────────────────────────────

describe('nextBookingSort', () => {
  it('toggles asc → desc when clicking the active field', () => {
    const result = nextBookingSort({ field: 'tourDate', dir: 'asc' }, 'tourDate')
    expect(result).toEqual({ field: 'tourDate', dir: 'desc' })
  })

  it('toggles desc → asc when clicking the active field', () => {
    const result = nextBookingSort({ field: 'tourDate', dir: 'desc' }, 'tourDate')
    expect(result).toEqual({ field: 'tourDate', dir: 'asc' })
  })

  it('switches field and resets dir to asc', () => {
    const result = nextBookingSort({ field: 'tourDate', dir: 'desc' }, 'group')
    expect(result).toEqual({ field: 'group', dir: 'asc' })
  })
})

// ── fetchBuddies ───────────────────────────────────────────────────────────

const stubBuddies: AdminBuddyResponse[] = [{ id: 'b1' } as AdminBuddyResponse]

describe('fetchBuddies', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockListBuddies.mockResolvedValue(stubBuddies)
    const result = await fetchBuddies(BuddyStatusSchema.enum.pending)
    expect(result).toEqual({ ok: true, data: stubBuddies })
    expect(mockListBuddies).toHaveBeenCalledWith(BuddyStatusSchema.enum.pending, undefined, undefined)
  })

  it('passes tier when provided', async () => {
    mockListBuddies.mockResolvedValue(stubBuddies)
    await fetchBuddies(BuddyStatusSchema.enum.active, BuddyTierSchema.enum.junior)
    expect(mockListBuddies).toHaveBeenCalledWith(BuddyStatusSchema.enum.active, BuddyTierSchema.enum.junior, undefined)
  })

  it('passes memberType when provided', async () => {
    mockListBuddies.mockResolvedValue(stubBuddies)
    await fetchBuddies(BuddyStatusSchema.enum.active, undefined, MemberTypeSchema.enum.plab_member)
    expect(mockListBuddies).toHaveBeenCalledWith(BuddyStatusSchema.enum.active, undefined, MemberTypeSchema.enum.plab_member)
  })

  it('returns not_found for 404', async () => {
    mockListBuddies.mockRejectedValue(new ApiError('not found', 404))
    const result = await fetchBuddies(BuddyStatusSchema.enum.pending)
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockListBuddies.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchBuddies(BuddyStatusSchema.enum.pending)
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

describe('fetchTrainees', () => {
  beforeEach(() => vi.resetAllMocks())

  it('calls listBuddies with status=trainee', async () => {
    mockListBuddies.mockResolvedValue(stubBuddies)
    const result = await fetchTrainees()
    expect(result).toEqual({ ok: true, data: stubBuddies })
    expect(mockListBuddies).toHaveBeenCalledWith(BuddyStatusSchema.enum.trainee, undefined, undefined)
  })
})

// ── fetchBuddy ─────────────────────────────────────────────────────────────

const stubBuddy: AdminBuddyDetailResponse = { id: 'b1', bookings: [] } as unknown as AdminBuddyDetailResponse

describe('fetchBuddy', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockGetBuddy.mockResolvedValue(stubBuddy)
    const result = await fetchBuddy('b1')
    expect(result).toEqual({ ok: true, data: stubBuddy })
    expect(mockGetBuddy).toHaveBeenCalledWith('b1')
  })

  it('returns not_found for 404', async () => {
    mockGetBuddy.mockRejectedValue(new ApiError('not found', 404))
    const result = await fetchBuddy('b1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockGetBuddy.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchBuddy('b1')
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── updateBuddy ────────────────────────────────────────────────────────────

describe('updateBuddy', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with updated data on success', async () => {
    const updated = { ...stubBuddy, tier: 'junior' } as AdminBuddyResponse
    mockUpdateBuddy.mockResolvedValue(updated)
    const result = await updateBuddy('b1', { tier: 'junior' })
    expect(result).toEqual({ ok: true, data: updated })
    expect(mockUpdateBuddy).toHaveBeenCalledWith('b1', { tier: 'junior' })
  })

  it('returns not_found for 404', async () => {
    mockUpdateBuddy.mockRejectedValue(new ApiError('not found', 404))
    const result = await updateBuddy('b1', { tier: 'junior' })
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockUpdateBuddy.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await updateBuddy('b1', { tier: 'junior' })
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── updateBuddyStatus ──────────────────────────────────────────────────────

describe('updateBuddyStatus', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok on success', async () => {
    mockUpdateBuddyStatus.mockResolvedValue(undefined)
    const result = await updateBuddyStatus('b1', BuddyStatusSchema.enum.active)
    expect(result).toEqual({ ok: true, data: undefined })
    expect(mockUpdateBuddyStatus).toHaveBeenCalledWith('b1', { status: BuddyStatusSchema.enum.active })
  })

  it('returns forbidden for 403', async () => {
    mockUpdateBuddyStatus.mockRejectedValue(new ApiError('forbidden', 403))
    const result = await updateBuddyStatus('b1', BuddyStatusSchema.enum.active)
    expect(result).toEqual({ ok: false, error: { code: 'forbidden' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockUpdateBuddyStatus.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await updateBuddyStatus('b1', BuddyStatusSchema.enum.active)
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

describe('buddyName', () => {
  const t = (key: string, values?: Record<string, string>) =>
    values ? `${key}:${values.displayName}/${values.realName}` : key

  it('formats display name with real name', () => {
    expect(buddyName(t, { displayName: 'ken', realName: '田中健一' })).toBe('nameWithReal:ken/田中健一')
  })

  it('falls back to display name when real name is empty', () => {
    expect(buddyName(t, { displayName: 'ken', realName: '' })).toBe('ken')
  })
})
