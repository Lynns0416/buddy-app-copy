import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { AdminEvaluationResponse } from '@peace-buddy/types'

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
  EvalNotFoundError: class EvalNotFoundError extends Error {
    constructor() { super('Evaluation not found') }
  },
  EvalAlreadyExistsError: class EvalAlreadyExistsError extends Error {
    constructor() { super('Already exists') }
  },
  BuddyNotFoundError: class BuddyNotFoundError extends Error {
    constructor() { super('Buddy not found') }
  },
  TourNotFoundError: class TourNotFoundError extends Error {
    constructor() { super('Tour not found') }
  },
}))

vi.mock('../services/adminProfileEvaluation.service', () => ({
  upsertProfileEvaluation: vi.fn(),
  getProfileEvaluation: vi.fn(),
  BuddyNotFoundError: class extends Error {},
}))

vi.mock('../services/selfEvaluation.service', () => ({
  listSelfEvaluations: vi.fn(),
  getSelfEvaluation: vi.fn(),
}))

import {
  createAdminEvaluation,
  listAdminEvaluations,
  getAdminEvaluation,
  updateAdminEvaluation,
  deleteAdminEvaluation,
  EvalNotFoundError,
  EvalAlreadyExistsError,
  BuddyNotFoundError,
  TourNotFoundError,
} from '../services/adminEvaluation.service'

const mockCreate = vi.mocked(createAdminEvaluation)
const mockList = vi.mocked(listAdminEvaluations)
const mockGet = vi.mocked(getAdminEvaluation)
const mockUpdate = vi.mocked(updateAdminEvaluation)
const mockDelete = vi.mocked(deleteAdminEvaluation)

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

const mockEval: AdminEvaluationResponse = {
  id: 'eval-1',
  buddyId: 'buddy-1',
  buddyDisplayName: 'Test Buddy',
  tourId: 'tour-1',
  tourDate: '2026-01-15T00:00:00.000Z',
  tourGroupName: 'Test Group',
  createdBy: 'user-1',
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

const validCreateBody = {
  buddyId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tourId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
  overallRating: 4,
  communication: 3,
}

describe('POST /admin/evaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an evaluation and returns 201', async () => {
    mockCreate.mockResolvedValueOnce(mockEval)
    const res = await buildApp().request('/admin/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ overallRating: 4 }), 'user-1')
  })

  it('returns 400 for missing buddyId', async () => {
    const res = await buildApp().request('/admin/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid score', async () => {
    const res = await buildApp().request('/admin/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreateBody, overallRating: 6 }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 when already exists', async () => {
    mockCreate.mockRejectedValueOnce(new EvalAlreadyExistsError())
    const res = await buildApp().request('/admin/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(409)
  })

  it('returns 404 when buddy not found', async () => {
    mockCreate.mockRejectedValueOnce(new BuddyNotFoundError())
    const res = await buildApp().request('/admin/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when tour not found', async () => {
    mockCreate.mockRejectedValueOnce(new TourNotFoundError())
    const res = await buildApp().request('/admin/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/evaluations', {
      method: 'POST',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /admin/evaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns evaluation list', async () => {
    mockList.mockResolvedValueOnce([mockEval])
    const res = await buildApp().request('/admin/evaluations')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminEvaluationResponse[]
    expect(body).toHaveLength(1)
    expect(mockList).toHaveBeenCalledWith({ buddyId: undefined, tourId: undefined })
  })

  it('passes filter params', async () => {
    mockList.mockResolvedValueOnce([])
    const res = await buildApp().request('/admin/evaluations?buddyId=b1&tourId=t1')
    expect(res.status).toBe(200)
    expect(mockList).toHaveBeenCalledWith({ buddyId: 'b1', tourId: 't1' })
  })
})

describe('GET /admin/evaluations/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns evaluation', async () => {
    mockGet.mockResolvedValueOnce(mockEval)
    const res = await buildApp().request('/admin/evaluations/eval-1')
    expect(res.status).toBe(200)
  })

  it('returns 404 when not found', async () => {
    mockGet.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/evaluations/missing')
    expect(res.status).toBe(404)
  })
})

describe('PUT /admin/evaluations/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates evaluation', async () => {
    mockUpdate.mockResolvedValueOnce({ ...mockEval, overallRating: 5 })
    const res = await buildApp().request('/admin/evaluations/eval-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 5 }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('eval-1', expect.objectContaining({ overallRating: 5 }))
  })

  it('returns 404 when not found', async () => {
    mockUpdate.mockRejectedValueOnce(new EvalNotFoundError())
    const res = await buildApp().request('/admin/evaluations/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 5 }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/evaluations/eval-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /admin/evaluations/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes evaluation and returns 204', async () => {
    mockDelete.mockResolvedValueOnce(undefined)
    const res = await buildApp().request('/admin/evaluations/eval-1', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mockDelete).toHaveBeenCalledWith('eval-1')
  })

  it('returns 404 when not found', async () => {
    mockDelete.mockRejectedValueOnce(new EvalNotFoundError())
    const res = await buildApp().request('/admin/evaluations/missing', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
