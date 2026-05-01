import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { selfEvaluationRoutes } from './selfEvaluations'
import type { AuthEnv } from '../types'
import type { SelfEvaluationResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

vi.mock('../services/selfEvaluation.service', () => ({
  createSelfEvaluation: vi.fn(),
  listMySelfEvaluations: vi.fn(),
  updateSelfEvaluation: vi.fn(),
  listSelfEvaluations: vi.fn(),
  getSelfEvaluation: vi.fn(),
  EvalNotFoundError: class EvalNotFoundError extends Error {
    constructor() { super('Not found') }
  },
  EvalAlreadyExistsError: class EvalAlreadyExistsError extends Error {
    constructor() { super('Already exists') }
  },
  EvalLockedError: class EvalLockedError extends Error {
    constructor() { super('Locked') }
  },
  NotEligibleError: class NotEligibleError extends Error {
    constructor() { super('Not eligible') }
  },
  BuddyNotFoundError: class BuddyNotFoundError extends Error {
    constructor() { super('Buddy not found') }
  },
  SELF_EVAL_EDIT_WINDOW_DAYS: 7,
}))

import {
  createSelfEvaluation,
  listMySelfEvaluations,
  updateSelfEvaluation,
  EvalNotFoundError,
  EvalAlreadyExistsError,
  EvalLockedError,
  NotEligibleError,
  BuddyNotFoundError,
} from '../services/selfEvaluation.service'

const mockCreate = vi.mocked(createSelfEvaluation)
const mockList = vi.mocked(listMySelfEvaluations)
const mockUpdate = vi.mocked(updateSelfEvaluation)

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-123', email: 'buddy@example.com' })
    c.set('user', { id: 'user-2', firebaseUid: 'uid-123', email: 'buddy@example.com', role: 'buddy' })
    return next()
  })
  app.route('/me/evaluations', selfEvaluationRoutes)
  return app
}

const mockSelfEval: SelfEvaluationResponse = {
  id: 'seval-1',
  buddyId: 'buddy-1',
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
  locked: false,
}

const validCreateBody = {
  tourId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  overallRating: 3,
}

describe('POST /me/evaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates self-evaluation and returns 201', async () => {
    mockCreate.mockResolvedValueOnce(mockSelfEval)
    const res = await buildApp().request('/me/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ overallRating: 3 }), 'user-2')
  })

  it('returns 400 for missing tourId', async () => {
    const res = await buildApp().request('/me/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 3 }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 when already submitted', async () => {
    mockCreate.mockRejectedValueOnce(new EvalAlreadyExistsError())
    const res = await buildApp().request('/me/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(409)
  })

  it('returns 403 when not eligible', async () => {
    mockCreate.mockRejectedValueOnce(new NotEligibleError())
    const res = await buildApp().request('/me/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 when buddy profile not found', async () => {
    mockCreate.mockRejectedValueOnce(new BuddyNotFoundError())
    const res = await buildApp().request('/me/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/me/evaluations', {
      method: 'POST',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /me/evaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns own evaluations', async () => {
    mockList.mockResolvedValueOnce([mockSelfEval])
    const res = await buildApp().request('/me/evaluations')
    expect(res.status).toBe(200)
    const body = await res.json() as SelfEvaluationResponse[]
    expect(body).toHaveLength(1)
    expect(mockList).toHaveBeenCalledWith('user-2')
  })

  it('returns 404 when buddy profile not found', async () => {
    mockList.mockRejectedValueOnce(new BuddyNotFoundError())
    const res = await buildApp().request('/me/evaluations')
    expect(res.status).toBe(404)
  })
})

describe('PUT /me/evaluations/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates self-evaluation', async () => {
    mockUpdate.mockResolvedValueOnce({ ...mockSelfEval, overallRating: 4 })
    const res = await buildApp().request('/me/evaluations/seval-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 4 }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('seval-1', expect.objectContaining({ overallRating: 4 }), 'user-2')
  })

  it('returns 404 when not found', async () => {
    mockUpdate.mockRejectedValueOnce(new EvalNotFoundError())
    const res = await buildApp().request('/me/evaluations/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 4 }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 409 when edit window has closed', async () => {
    mockUpdate.mockRejectedValueOnce(new EvalLockedError())
    const res = await buildApp().request('/me/evaluations/seval-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallRating: 4 }),
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string; detail: string }
    expect(body).toEqual({ code: 'conflict', detail: 'Edit window has closed' })
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/me/evaluations/seval-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})
