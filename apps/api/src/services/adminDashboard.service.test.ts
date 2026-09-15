import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BuddyStatusSchema } from '@peace-buddy/types'
import type {
  AdminBuddyResponse,
  AdminDashboardMissingEvaluationTour,
  AdminDashboardOverdueMaybeTour,
  AdminDashboardUnderfilledTour,
} from '@peace-buddy/types'

vi.mock('./admin.service', () => ({ listBuddies: vi.fn() }))
vi.mock('./maybeDeadline.service', () => ({ listOverdueMaybeTours: vi.fn() }))
vi.mock('./adminTour.service', () => ({ listUnderfilledTours: vi.fn() }))
vi.mock('./adminEvaluation.service', () => ({ listToursMissingEvaluations: vi.fn() }))

import { listBuddies } from './admin.service'
import { listOverdueMaybeTours } from './maybeDeadline.service'
import { listUnderfilledTours } from './adminTour.service'
import { listToursMissingEvaluations } from './adminEvaluation.service'
import { getAdminDashboard, UNDERFILLED_LOOKAHEAD_DAYS } from './adminDashboard.service'

const NOW = new Date('2026-06-20T15:30:00Z')

const pendingBuddy: AdminBuddyResponse = {
  id: 'b1',
  userId: 'u1',
  status: 'pending',
  tier: null,
  memberType: 'buddy',
  displayName: 'Aya',
  realName: 'Aya Tanaka',
  photoUrl: null,
  email: 'aya@example.com',
  internalNotes: 'private',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const overdue: AdminDashboardOverdueMaybeTour = {
  id: 't1',
  tourDate: '2026-07-04T00:00:00.000Z',
  group: { name: 'Sakura School' },
  maybeDeadline: '2026-06-19T00:00:00.000Z',
  maybeCount: 2,
}

const underfilled: AdminDashboardUnderfilledTour = {
  id: 't2',
  tourDate: '2026-06-25T00:00:00.000Z',
  group: { name: 'Hikari School' },
  sessions: [{ id: 's1', order: 1, label: null, minBuddies: 3, confirmedCount: 1 }],
}

const missing: AdminDashboardMissingEvaluationTour = {
  id: 't3',
  tourDate: '2026-06-10T00:00:00.000Z',
  group: { name: 'Minato Co.' },
  missingCount: 4,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listBuddies).mockResolvedValue([pendingBuddy])
  vi.mocked(listOverdueMaybeTours).mockResolvedValue([overdue])
  vi.mocked(listUnderfilledTours).mockResolvedValue([underfilled])
  vi.mocked(listToursMissingEvaluations).mockResolvedValue([missing])
})

describe('getAdminDashboard', () => {
  it('reads pending buddies through the roster query the pending page uses', async () => {
    await getAdminDashboard(NOW)

    expect(listBuddies).toHaveBeenCalledWith(BuddyStatusSchema.enum.pending)
  })

  it('exposes only the fields the worklist shows for a pending buddy', async () => {
    const result = await getAdminDashboard(NOW)

    expect(result.pendingBuddies).toEqual([
      { id: 'b1', displayName: 'Aya', createdAt: '2026-06-01T00:00:00.000Z' },
    ])
  })

  it('evaluates the dated queues against one clock', async () => {
    await getAdminDashboard(NOW)

    expect(listOverdueMaybeTours).toHaveBeenCalledWith(NOW)
    expect(listUnderfilledTours).toHaveBeenCalledWith(NOW, UNDERFILLED_LOOKAHEAD_DAYS)
  })

  it('returns each tour queue as its owning service computed it, with the lookahead it used', async () => {
    const result = await getAdminDashboard(NOW)

    expect(result.overdueMaybeTours).toEqual([overdue])
    expect(result.underfilledTours).toEqual([underfilled])
    expect(result.underfilledLookaheadDays).toBe(UNDERFILLED_LOOKAHEAD_DAYS)
    expect(result.toursMissingEvaluations).toEqual([missing])
  })
})
