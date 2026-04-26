import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortBuddies, nextBuddySort, fetchBuddies, updateBuddyStatus } from './admin.buddy'
import type { AdminBuddyResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listBuddies: vi.fn(),
    updateBuddyStatus: vi.fn(),
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

const alice   = buddy({ id: 'b1', displayName: 'Alice',   email: 'alice@example.com' })
const bob     = buddy({ id: 'b2', displayName: 'Bob',     email: 'bob@example.com' })
const charlie = buddy({ id: 'b3', displayName: 'Charlie', email: 'charlie@example.com' })

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
