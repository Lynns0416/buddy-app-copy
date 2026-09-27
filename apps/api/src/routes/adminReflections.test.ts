import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { AdminTourReflectionResponse } from '@peace-buddy/types'

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

vi.mock('../services/reflection.service', () => ({
  createReflection: vi.fn(),
  listMyReflections: vi.fn(),
  updateReflection: vi.fn(),
  ReflectionNotFoundError: class extends Error {},
  ReflectionAlreadyExistsError: class extends Error {},
  ReflectionLockedError: class extends Error {},
  NotEligibleError: class extends Error {},
  BuddyNotFoundError: class extends Error {},
  REFLECTION_EDIT_WINDOW_DAYS: 7,
}))

vi.mock('../services/adminReflectionStats.service', () => ({
  listReflectionStats: vi.fn(),
}))

vi.mock('../services/adminReflection.service', () => ({
  listReflections: vi.fn(),
  getReflection: vi.fn(),
}))

import {
  listReflections,
  getReflection,
} from '../services/adminReflection.service'
import { listReflectionStats } from '../services/adminReflectionStats.service'

const mockList = vi.mocked(listReflections)
const mockGet = vi.mocked(getReflection)
const mockStats = vi.mocked(listReflectionStats)

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

const mockReflection: AdminTourReflectionResponse = {
  id: 'refl-1',
  buddyId: 'buddy-1',
  buddyDisplayName: 'Test Buddy',
  sessionId: 'session-1',
  sessionOrder: 1,
  sessionLabel: null,
  tourId: 'tour-1',
  tourDate: '2026-01-01T00:00:00.000Z',
  didWell: 'Kept everyone together',
  couldImprove: null,
  notesForOthers: null,
  openQuestions: null,
  moments: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('GET /admin/reflections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the reflection list', async () => {
    mockList.mockResolvedValueOnce([mockReflection])
    const res = await buildApp().request('/admin/reflections')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminTourReflectionResponse[]
    expect(body).toHaveLength(1)
    expect(mockList).toHaveBeenCalledWith({ buddyId: undefined })
  })

  it('passes buddyId filter', async () => {
    mockList.mockResolvedValueOnce([])
    const res = await buildApp().request('/admin/reflections?buddyId=buddy-1')
    expect(res.status).toBe(200)
    expect(mockList).toHaveBeenCalledWith({ buddyId: 'buddy-1' })
  })
})

describe('GET /admin/reflections/stats', () => {
  beforeEach(() => vi.clearAllMocks())

  const TOUR_ID = '00000000-0000-0000-0001-000000000021'

  it('is not read as a reflection id', async () => {
    mockStats.mockResolvedValueOnce({ reflections: [], buddies: [], places: [] })
    const res = await buildApp().request('/admin/reflections/stats')
    expect(res.status).toBe(200)
    expect(mockStats).toHaveBeenCalledWith({})
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('passes the scope, dates as UTC midnight', async () => {
    mockStats.mockResolvedValueOnce({ reflections: [], buddies: [], places: [] })
    const res = await buildApp().request(`/admin/reflections/stats?from=2026-04-01&to=2026-06-30&groupType=school&tourId=${TOUR_ID}`)
    expect(res.status).toBe(200)
    expect(mockStats).toHaveBeenCalledWith({
      from: new Date('2026-04-01T00:00:00.000Z'),
      to: new Date('2026-06-30T00:00:00.000Z'),
      groupType: 'school',
      tourId: TOUR_ID,
    })
  })

  it.each([
    ['a tourId that is not a uuid', '?tourId=tour-1'],
    ['an unknown group type', '?groupType=circus'],
    ['a range that ends before it starts', '?from=2026-06-30&to=2026-04-01'],
  ])('rejects %s', async (_, query) => {
    const res = await buildApp().request(`/admin/reflections/stats${query}`)
    expect(res.status).toBe(400)
    expect(mockStats).not.toHaveBeenCalled()
  })
})

describe('GET /admin/reflections/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the reflection', async () => {
    mockGet.mockResolvedValueOnce(mockReflection)
    const res = await buildApp().request('/admin/reflections/refl-1')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminTourReflectionResponse
    expect(body.id).toBe('refl-1')
  })

  it('returns 404 when not found', async () => {
    mockGet.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/reflections/missing')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })
})
