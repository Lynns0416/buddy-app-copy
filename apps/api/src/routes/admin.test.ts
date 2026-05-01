import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import { listBuddies, updateBuddyStatus, getBuddyDetail, updateBuddyProfile } from '../services/admin.service'
import type { AdminBuddyResponse, AdminBuddyDetailResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

vi.mock('../services/admin.service', () => ({
  listBuddies: vi.fn(),
  updateBuddyStatus: vi.fn(),
  getBuddyDetail: vi.fn(),
  updateBuddyProfile: vi.fn(),
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
  getProfileEvaluation: vi.fn(),
  BuddyNotFoundError: class extends Error {},
}))

vi.mock('../services/selfEvaluation.service', () => ({
  listSelfEvaluations: vi.fn(),
  getSelfEvaluation: vi.fn(),
}))

const mockListBuddies = vi.mocked(listBuddies)
const mockUpdateBuddyStatus = vi.mocked(updateBuddyStatus)
const mockGetBuddyDetail = vi.mocked(getBuddyDetail)
const mockUpdateBuddyProfile = vi.mocked(updateBuddyProfile)

function buildApp(role: string) {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-123', email: 'admin@example.com' })
    c.set('user', { id: 'user-1', firebaseUid: 'uid-123', email: 'admin@example.com', role })
    return next()
  })
  app.use('/admin/*', adminAuthMiddleware)
  app.route('/admin', adminRoutes)
  return app
}

const mockBuddy = {
  id: 'profile-1',
  userId: 'user-1',
  status: 'pending',
  tier: null,
  displayName: 'Test Buddy',
  realName: 'Real Name',
  email: 'buddy@example.com',
  internalNotes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  bookings: [],
}

describe('admin routes — auth', () => {
  it('returns 401 with no token', async () => {
    const res = await routes.request('/admin/buddies')
    expect(res.status).toBe(401)
  })

  it('returns 403 for buddy role', async () => {
    const res = await buildApp('buddy').request('/admin/buddies')
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin role', async () => {
    const res = await buildApp('other').request('/admin/buddies')
    expect(res.status).toBe(403)
  })

  it('passes through for admin role', async () => {
    mockListBuddies.mockResolvedValueOnce([])
    const res = await buildApp('admin').request('/admin/buddies')
    expect(res.status).toBe(200)
  })

  it('passes through for super_admin role', async () => {
    mockListBuddies.mockResolvedValueOnce([])
    const res = await buildApp('super_admin').request('/admin/buddies')
    expect(res.status).toBe(200)
  })
})

describe('GET /admin/buddies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns buddy list', async () => {
    mockListBuddies.mockResolvedValueOnce([mockBuddy] as unknown as AdminBuddyResponse[])
    const res = await buildApp('admin').request('/admin/buddies')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminBuddyResponse[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('profile-1')
  })

  it('filters by status query param', async () => {
    mockListBuddies.mockResolvedValueOnce([mockBuddy] as unknown as AdminBuddyResponse[])
    await buildApp('admin').request('/admin/buddies?status=pending')
    expect(mockListBuddies).toHaveBeenCalledWith('pending')
  })

  it('returns 400 for invalid status', async () => {
    const res = await buildApp('admin').request('/admin/buddies?status=invalid')
    expect(res.status).toBe(400)
  })

  it('calls listBuddies with no args when status omitted', async () => {
    mockListBuddies.mockResolvedValueOnce([])
    await buildApp('admin').request('/admin/buddies')
    expect(mockListBuddies).toHaveBeenCalledWith()
  })
})

describe('GET /admin/buddies/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns buddy detail', async () => {
    mockGetBuddyDetail.mockResolvedValueOnce(mockBuddy as unknown as AdminBuddyDetailResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminBuddyDetailResponse
    expect(body.id).toBe('profile-1')
    expect(mockGetBuddyDetail).toHaveBeenCalledWith('profile-1')
  })

  it('returns 404 when buddy not found', async () => {
    mockGetBuddyDetail.mockResolvedValueOnce(null)
    const res = await buildApp('admin').request('/admin/buddies/missing')
    expect(res.status).toBe(404)
  })
})

describe('PUT /admin/buddies/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates tier and internalNotes', async () => {
    mockUpdateBuddyProfile.mockResolvedValueOnce({ ...mockBuddy, tier: 'junior', internalNotes: 'good' } as unknown as AdminBuddyResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'junior', internalNotes: 'good' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateBuddyProfile).toHaveBeenCalledWith('profile-1', 'junior', 'good')
  })

  it('returns 404 when buddy not found', async () => {
    mockUpdateBuddyProfile.mockResolvedValueOnce(null)
    const res = await buildApp('admin').request('/admin/buddies/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'junior' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid body', async () => {
    const res = await buildApp('admin').request('/admin/buddies/profile-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'invalid_tier' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp('admin').request('/admin/buddies/profile-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('PUT /admin/buddies/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approves a buddy', async () => {
    mockUpdateBuddyStatus.mockResolvedValueOnce({ ...mockBuddy, status: 'active', tier: 'trainee' } as unknown as AdminBuddyResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateBuddyStatus).toHaveBeenCalledWith('profile-1', 'active', undefined)
  })

  it('rejects a buddy', async () => {
    mockUpdateBuddyStatus.mockResolvedValueOnce({ ...mockBuddy, status: 'rejected' } as unknown as AdminBuddyResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateBuddyStatus).toHaveBeenCalledWith('profile-1', 'rejected', undefined)
  })

  it('returns 404 when buddy not found', async () => {
    mockUpdateBuddyStatus.mockResolvedValueOnce(null)
    const res = await buildApp('admin').request('/admin/buddies/missing/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid body', async () => {
    const res = await buildApp('admin').request('/admin/buddies/profile-1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp('admin').request('/admin/buddies/profile-1/status', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})
