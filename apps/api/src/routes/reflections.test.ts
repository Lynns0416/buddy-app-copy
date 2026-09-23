import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { reflectionRoutes } from './reflections'
import type { AuthEnv } from '../types'
import type { TourReflectionResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

vi.mock('../services/reflection.service', () => ({
  createReflection: vi.fn(),
  listMyReflections: vi.fn(),
  updateReflection: vi.fn(),
  ReflectionNotFoundError: class ReflectionNotFoundError extends Error {
    constructor() { super('Not found') }
  },
  ReflectionAlreadyExistsError: class ReflectionAlreadyExistsError extends Error {
    constructor() { super('Already exists') }
  },
  ReflectionLockedError: class ReflectionLockedError extends Error {
    constructor() { super('Locked') }
  },
  NotEligibleError: class NotEligibleError extends Error {
    constructor() { super('Not eligible') }
  },
  BuddyNotFoundError: class BuddyNotFoundError extends Error {
    constructor() { super('Buddy not found') }
  },
  REFLECTION_EDIT_WINDOW_DAYS: 7,
}))

import {
  createReflection,
  listMyReflections,
  updateReflection,
  ReflectionNotFoundError,
  ReflectionAlreadyExistsError,
  ReflectionLockedError,
  NotEligibleError,
  BuddyNotFoundError,
} from '../services/reflection.service'

const mockCreate = vi.mocked(createReflection)
const mockList = vi.mocked(listMyReflections)
const mockUpdate = vi.mocked(updateReflection)

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-123', email: 'buddy@example.com' })
    c.set('user', { id: 'user-2', firebaseUid: 'uid-123', email: 'buddy@example.com', role: 'buddy' })
    return next()
  })
  app.route('/me/reflections', reflectionRoutes)
  return app
}

const mockReflection: TourReflectionResponse = {
  id: 'refl-1',
  buddyId: 'buddy-1',
  sessionId: 'session-1',
  sessionOrder: 1,
  sessionLabel: null,
  tourId: 'tour-1',
  didWell: 'Kept everyone together',
  couldImprove: null,
  memorableMoment: null,
  notesForOthers: null,
  openQuestions: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

const validCreateBody = {
  sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  didWell: 'Kept everyone together',
}

describe('POST /me/reflections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a reflection and returns 201', async () => {
    mockCreate.mockResolvedValueOnce(mockReflection)
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ didWell: 'Kept everyone together' }),
      'user-2',
    )
  })

  it('returns 400 for missing sessionId', async () => {
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ didWell: 'Kept everyone together' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when all five prompts are blank', async () => {
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreateBody, didWell: '   ' }),
    })
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('accepts a body where only one prompt is filled in', async () => {
    mockCreate.mockResolvedValueOnce(mockReflection)
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: validCreateBody.sessionId,
        didWell: null,
        couldImprove: null,
        memorableMoment: null,
        notesForOthers: null,
        openQuestions: 'What is the support scheme for second-generation survivors?',
      }),
    })
    expect(res.status).toBe(201)
  })

  it('returns 409 when already written', async () => {
    mockCreate.mockRejectedValueOnce(new ReflectionAlreadyExistsError())
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(409)
  })

  it('returns 403 when not eligible', async () => {
    mockCreate.mockRejectedValueOnce(new NotEligibleError())
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 when buddy profile not found', async () => {
    mockCreate.mockRejectedValueOnce(new BuddyNotFoundError())
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/me/reflections', {
      method: 'POST',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /me/reflections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns own reflections', async () => {
    mockList.mockResolvedValueOnce([mockReflection])
    const res = await buildApp().request('/me/reflections')
    expect(res.status).toBe(200)
    const body = await res.json() as TourReflectionResponse[]
    expect(body).toHaveLength(1)
    expect(mockList).toHaveBeenCalledWith('user-2', { tourId: undefined })
  })

  it('passes tourId filter', async () => {
    mockList.mockResolvedValueOnce([mockReflection])
    const res = await buildApp().request('/me/reflections?tourId=tour-1')
    expect(res.status).toBe(200)
    expect(mockList).toHaveBeenCalledWith('user-2', { tourId: 'tour-1' })
  })

  it('returns 404 when buddy profile not found', async () => {
    mockList.mockRejectedValueOnce(new BuddyNotFoundError())
    const res = await buildApp().request('/me/reflections')
    expect(res.status).toBe(404)
  })
})

describe('PUT /me/reflections/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a reflection', async () => {
    mockUpdate.mockResolvedValueOnce({ ...mockReflection, didWell: 'Kept calm' })
    const res = await buildApp().request('/me/reflections/refl-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ didWell: 'Kept calm' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('refl-1', expect.objectContaining({ didWell: 'Kept calm' }), 'user-2')
  })

  it('returns 400 when an edit would blank every prompt', async () => {
    const res = await buildApp().request('/me/reflections/refl-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ didWell: '', couldImprove: null }),
    })
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when not found', async () => {
    mockUpdate.mockRejectedValueOnce(new ReflectionNotFoundError())
    const res = await buildApp().request('/me/reflections/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ didWell: 'Kept calm' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 409 when edit window has closed', async () => {
    mockUpdate.mockRejectedValueOnce(new ReflectionLockedError())
    const res = await buildApp().request('/me/reflections/refl-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ didWell: 'Kept calm' }),
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string; detail: string }
    expect(body).toEqual({ code: 'conflict', detail: 'Edit window has closed' })
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/me/reflections/refl-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})
