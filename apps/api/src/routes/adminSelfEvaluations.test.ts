import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { AdminSelfEvaluationResponse } from '@peace-buddy/types'

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
  getProfileEvaluation: vi.fn(),
  BuddyNotFoundError: class extends Error {},
}))

vi.mock('../services/selfEvaluation.service', () => ({
  createSelfEvaluation: vi.fn(),
  listMySelfEvaluations: vi.fn(),
  updateSelfEvaluation: vi.fn(),
  EvalNotFoundError: class extends Error {},
  EvalAlreadyExistsError: class extends Error {},
  EvalLockedError: class extends Error {},
  NotEligibleError: class extends Error {},
  BuddyNotFoundError: class extends Error {},
  SELF_EVAL_EDIT_WINDOW_DAYS: 7,
}))

vi.mock('../services/adminSelfEvaluation.service', () => ({
  listSelfEvaluations: vi.fn(),
  getSelfEvaluation: vi.fn(),
}))

import {
  listSelfEvaluations,
  getSelfEvaluation,
} from '../services/adminSelfEvaluation.service'

const mockList = vi.mocked(listSelfEvaluations)
const mockGet = vi.mocked(getSelfEvaluation)

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

const mockSelfEval: AdminSelfEvaluationResponse = {
  id: 'seval-1',
  buddyId: 'buddy-1',
  buddyDisplayName: 'Test Buddy',
  tourId: 'tour-1',
  overallRating: 3,
  overallRatingNote: null,
  communication: null,
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

describe('GET /admin/self-evaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns self-evaluation list', async () => {
    mockList.mockResolvedValueOnce([mockSelfEval])
    const res = await buildApp().request('/admin/self-evaluations')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminSelfEvaluationResponse[]
    expect(body).toHaveLength(1)
    expect(mockList).toHaveBeenCalledWith({ buddyId: undefined })
  })

  it('passes buddyId filter', async () => {
    mockList.mockResolvedValueOnce([])
    const res = await buildApp().request('/admin/self-evaluations?buddyId=buddy-1')
    expect(res.status).toBe(200)
    expect(mockList).toHaveBeenCalledWith({ buddyId: 'buddy-1' })
  })
})

describe('GET /admin/self-evaluations/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns self-evaluation', async () => {
    mockGet.mockResolvedValueOnce(mockSelfEval)
    const res = await buildApp().request('/admin/self-evaluations/seval-1')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminSelfEvaluationResponse
    expect(body.id).toBe('seval-1')
  })

  it('returns 404 when not found', async () => {
    mockGet.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/self-evaluations/missing')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })
})
