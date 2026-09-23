import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { AdminProfileEvaluationResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

vi.mock('../services/admin.service', () => ({
  listBuddies: vi.fn(),
  updateBuddyStatus: vi.fn(),
}))

vi.mock('../services/group.service', () => ({
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  getGroup: vi.fn(),
}))

vi.mock('../services/adminTour.service', () => ({
  listAdminTours: vi.fn(),
  createTour: vi.fn(),
  getAdminTourDetail: vi.fn(),
  updateTour: vi.fn(),
  transitionTourStatus: vi.fn(),
  deleteTour: vi.fn(),
  TourNotFoundError: class extends Error {},
  TourTransitionError: class extends Error {},
  TourImmutableError: class extends Error {},
  TourNotDraftError: class extends Error {},
}))

vi.mock('../services/adminEvaluation.service', () => ({
  createAdminEvaluation: vi.fn(),
  listAdminEvaluations: vi.fn(),
  getAdminEvaluation: vi.fn(),
  updateAdminEvaluation: vi.fn(),
  deleteAdminEvaluation: vi.fn(),
  EvalNotFoundError: class extends Error {},
  EvalAlreadyExistsError: class extends Error {},
  BuddyNotFoundError: class extends Error {},
  TourNotFoundError: class extends Error {},
}))

vi.mock('../services/adminProfileEvaluation.service', () => ({
  upsertProfileEvaluation: vi.fn(),
  getMyProfileEvaluation: vi.fn(),
  listProfileEvaluations: vi.fn(),
  BuddyNotFoundError: class BuddyNotFoundError extends Error {
    constructor() { super('Buddy not found') }
  },
}))

vi.mock('../services/reflection.service', () => ({}))

vi.mock('../services/adminReflection.service', () => ({
  listReflections: vi.fn(),
  getReflection: vi.fn(),
}))

vi.mock('../services/adminSession.service', () => ({
  addSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  getSessionTierCapacities: vi.fn(),
  upsertSessionTierCapacities: vi.fn(),
  SessionNotFoundError: class extends Error {},
  SessionHasBookingsError: class extends Error {},
  LastSessionError: class extends Error {},
  TooManySessionsError: class extends Error {},
}))

import {
  upsertProfileEvaluation,
  getMyProfileEvaluation,
  listProfileEvaluations,
  BuddyNotFoundError,
} from '../services/adminProfileEvaluation.service'

const mockUpsert = vi.mocked(upsertProfileEvaluation)
const mockGetMine = vi.mocked(getMyProfileEvaluation)
const mockList = vi.mocked(listProfileEvaluations)

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-123', email: 'admin@example.com' })
    c.set('user', { id: 'user-1', firebaseUid: 'uid-123', email: 'admin@example.com', role: 'admin' })
    return next()
  })
  app.use('/admin/*', adminAuthMiddleware)
  app.route('/admin', adminRoutes)
  return app
}

const mockProfileEval: AdminProfileEvaluationResponse = {
  id: 'peval-1',
  buddyId: 'buddy-1',
  createdBy: 'user-1',
  createdByName: 'Test Admin',
  overallRating: 4,
  overallRatingNote: null,
  reliability: null,
  reliabilityNote: null,
  communication: 3,
  communicationNote: null,
  groupEngagement: null,
  groupEngagementNote: null,
  memory: null,
  memoryNote: null,
  knowledge: null,
  knowledgeNote: null,
  dedication: null,
  dedicationNote: null,
  dialogue: null,
  dialogueNote: null,
  adaptability: null,
  adaptabilityNote: null,
  emotionNote: null,
  confidence: null,
  confidenceNote: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('PUT /admin/profile-evaluations/:buddyId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts profile evaluation', async () => {
    mockUpsert.mockResolvedValueOnce(mockProfileEval)
    const res = await buildApp().request('/admin/profile-evaluations/buddy-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 4, communication: 3 }),
    })
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      'buddy-1',
      expect.objectContaining({ overallRating: 4 }),
      'user-1',
    )
  })

  it('returns 404 when buddy not found', async () => {
    mockUpsert.mockRejectedValueOnce(new BuddyNotFoundError())
    const res = await buildApp().request('/admin/profile-evaluations/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 4 }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid score', async () => {
    const res = await buildApp().request('/admin/profile-evaluations/buddy-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 0 }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/profile-evaluations/buddy-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /admin/profile-evaluations/:buddyId/mine', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns my profile evaluation', async () => {
    mockGetMine.mockResolvedValueOnce(mockProfileEval)
    const res = await buildApp().request('/admin/profile-evaluations/buddy-1/mine')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminProfileEvaluationResponse
    expect(body.buddyId).toBe('buddy-1')
    expect(body.createdByName).toBe('Test Admin')
    expect(mockGetMine).toHaveBeenCalledWith('buddy-1', 'user-1')
  })

  it('returns 404 when not found', async () => {
    mockGetMine.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/profile-evaluations/missing/mine')
    expect(res.status).toBe(404)
  })
})

describe('GET /admin/profile-evaluations/:buddyId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of profile evaluations', async () => {
    mockList.mockResolvedValueOnce([mockProfileEval])
    const res = await buildApp().request('/admin/profile-evaluations/buddy-1')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminProfileEvaluationResponse[]
    expect(body).toHaveLength(1)
    expect(body[0].buddyId).toBe('buddy-1')
  })

  it('returns empty array when none exist', async () => {
    mockList.mockResolvedValueOnce([])
    const res = await buildApp().request('/admin/profile-evaluations/buddy-1')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminProfileEvaluationResponse[]
    expect(body).toEqual([])
  })
})
