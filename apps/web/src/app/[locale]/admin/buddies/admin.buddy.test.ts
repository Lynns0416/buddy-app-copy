import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortBuddies, nextBuddySort, fetchBuddies, updateBuddyStatus, fetchBuddy, updateBuddy } from './admin.buddy'
import type { AdminBuddyResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'

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
  tier: 'trainee',
  status: 'pending',
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
} as AdminBuddyResponse)

const alice   = buddy({ id: 'b1', displayName: 'Alice',   email: 'alice@example.com',   tier: 'junior' })
const bob     = buddy({ id: 'b2', displayName: 'Bob',     email: 'bob@example.com',     tier: 'senior' })
const charlie = buddy({ id: 'b3', displayName: 'Charlie', email: 'charlie@example.com', tier: 'mid' })

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
      expect(result.map((b) => b.tier)).toEqual(['junior', 'mid', 'senior'])
    })

    it('sorts desc', () => {
      const result = sortBuddies([bob, alice, charlie], 'tier', 'desc')
      expect(result.map((b) => b.tier)).toEqual(['senior', 'mid', 'junior'])
    })

    it('sorts null tier as empty string (before others) asc', () => {
      const noTier = buddy({ id: 'b4', tier: null })
      const result = sortBuddies([alice, noTier], 'tier', 'asc')
      expect(result[0].id).toBe('b4')
    })
  })

  it('returns empty array unchanged', () => {
    expect(sortBuddies([], 'displayName', 'asc')).toEqual([])
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

// ── fetchBuddies ───────────────────────────────────────────────────────────

const stubBuddies: AdminBuddyResponse[] = [{ id: 'b1' } as AdminBuddyResponse]

describe('fetchBuddies', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockListBuddies.mockResolvedValue(stubBuddies)
    const result = await fetchBuddies(BuddyStatusSchema.enum.pending)
    expect(result).toEqual({ ok: true, data: stubBuddies })
    expect(mockListBuddies).toHaveBeenCalledWith(BuddyStatusSchema.enum.pending)
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

// ── fetchBuddy ─────────────────────────────────────────────────────────────

const stubBuddy: AdminBuddyResponse = { id: 'b1' } as AdminBuddyResponse

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
