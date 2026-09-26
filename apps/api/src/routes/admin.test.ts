import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import { listBuddies, updateBuddyStatus, getBuddyDetail, updateBuddyProfile, updateCancellationReason, updateAdminBookingStatus } from '../services/admin.service'
import { listBuddyStats } from '../services/adminBuddyStats.service'
import type { AdminBuddyStatsResponse, AdminBuddyResponse, AdminBuddyDetailResponse, CancellationReasonResponse, AdminBookingStatusResponse } from '@peace-buddy/types'

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
  updateCancellationReason: vi.fn(),
  updateAdminBookingStatus: vi.fn(),
}))

vi.mock('../services/adminBuddyStats.service', () => ({
  listBuddyStats: vi.fn(),
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

const mockListBuddies = vi.mocked(listBuddies)
const mockUpdateBuddyStatus = vi.mocked(updateBuddyStatus)
const mockGetBuddyDetail = vi.mocked(getBuddyDetail)
const mockUpdateBuddyProfile = vi.mocked(updateBuddyProfile)
const mockUpdateCancellationReason = vi.mocked(updateCancellationReason)
const mockUpdateAdminBookingStatus = vi.mocked(updateAdminBookingStatus)

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
  memberType: 'buddy',
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
    expect(mockListBuddies).toHaveBeenCalledWith('pending', undefined, undefined)
  })

  it('filters by tier query param', async () => {
    mockListBuddies.mockResolvedValueOnce([])
    await buildApp('admin').request('/admin/buddies?status=active&tier=junior')
    expect(mockListBuddies).toHaveBeenCalledWith('active', 'junior', undefined)
  })

  it('filters by memberType query param', async () => {
    mockListBuddies.mockResolvedValueOnce([])
    await buildApp('admin').request('/admin/buddies?status=active&memberType=plab_member')
    expect(mockListBuddies).toHaveBeenCalledWith('active', undefined, 'plab_member')
  })

  it('returns 400 for invalid memberType', async () => {
    const res = await buildApp('admin').request('/admin/buddies?memberType=invalid')
    expect(res.status).toBe(400)
  })

  it('returns 400 for tier=trainee (trainee is a status, not a tier)', async () => {
    const res = await buildApp('admin').request('/admin/buddies?tier=trainee')
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status', async () => {
    const res = await buildApp('admin').request('/admin/buddies?status=invalid')
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid tier', async () => {
    const res = await buildApp('admin').request('/admin/buddies?tier=invalid')
    expect(res.status).toBe(400)
  })

  it('calls listBuddies with undefined args when params omitted', async () => {
    mockListBuddies.mockResolvedValueOnce([])
    await buildApp('admin').request('/admin/buddies')
    expect(mockListBuddies).toHaveBeenCalledWith(undefined, undefined, undefined)
  })
})

describe('GET /admin/buddies/stats', () => {
  const statsResponse: AdminBuddyStatsResponse = { places: [], buddies: [] }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listBuddyStats).mockResolvedValue(statsResponse)
  })

  it('returns 403 for buddy role', async () => {
    const res = await buildApp('buddy').request('/admin/buddies/stats')
    expect(res.status).toBe(403)
    expect(listBuddyStats).not.toHaveBeenCalled()
  })

  it('returns all-time stats with no scope, not the buddy detail', async () => {
    const res = await buildApp('admin').request('/admin/buddies/stats')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(statsResponse)
    expect(listBuddyStats).toHaveBeenCalledWith({})
    expect(mockGetBuddyDetail).not.toHaveBeenCalled()
  })

  it('reads the date range as UTC-midnight calendar dates', async () => {
    const placeId = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f'
    const res = await buildApp('admin').request(
      `/admin/buddies/stats?from=2026-04-01&to=2027-03-31&groupType=school&placeId=${placeId}`,
    )
    expect(res.status).toBe(200)
    expect(listBuddyStats).toHaveBeenCalledWith({
      from: new Date('2026-04-01T00:00:00.000Z'),
      to: new Date('2027-03-31T00:00:00.000Z'),
      groupType: 'school',
      placeId,
    })
  })

  it.each([
    ['a date that is not YYYY-MM-DD', 'from=2026/04/01'],
    ['an impossible date', 'to=2026-13-45'],
    ['an unknown group type', 'groupType=club'],
    ['a place id that is not a uuid', 'placeId=hall'],
    ['a range that ends before it starts', 'from=2026-05-01&to=2026-04-30'],
  ])('returns 400 for %s', async (_label, query) => {
    const res = await buildApp('admin').request(`/admin/buddies/stats?${query}`)
    expect(res.status).toBe(400)
    expect(listBuddyStats).not.toHaveBeenCalled()
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
    expect(mockUpdateBuddyProfile).toHaveBeenCalledWith('profile-1', 'junior', 'good', undefined)
  })

  it('updates memberType', async () => {
    mockUpdateBuddyProfile.mockResolvedValueOnce({ ...mockBuddy, memberType: 'plab_member' } as unknown as AdminBuddyResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberType: 'plab_member' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateBuddyProfile).toHaveBeenCalledWith('profile-1', undefined, undefined, 'plab_member')
  })

  it('returns 400 for invalid memberType', async () => {
    const res = await buildApp('admin').request('/admin/buddies/profile-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberType: 'employee' }),
    })
    expect(res.status).toBe(400)
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

  it('approves a buddy as trainee', async () => {
    mockUpdateBuddyStatus.mockResolvedValueOnce({ ...mockBuddy, status: 'trainee', tier: null } as unknown as AdminBuddyResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'trainee' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateBuddyStatus).toHaveBeenCalledWith('profile-1', 'trainee')
  })

  it('promotes a trainee to active', async () => {
    mockUpdateBuddyStatus.mockResolvedValueOnce({ ...mockBuddy, status: 'active', tier: 'junior' } as unknown as AdminBuddyResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateBuddyStatus).toHaveBeenCalledWith('profile-1', 'active')
  })

  it('rejects a buddy', async () => {
    mockUpdateBuddyStatus.mockResolvedValueOnce({ ...mockBuddy, status: 'rejected' } as unknown as AdminBuddyResponse)
    const res = await buildApp('admin').request('/admin/buddies/profile-1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateBuddyStatus).toHaveBeenCalledWith('profile-1', 'rejected')
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

describe('PATCH /admin/bookings/:bookingId/cancellation-reason', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockReason: CancellationReasonResponse = {
    id: 'cr-1',
    category: 'health',
    freeText: null,
    unavoidable: true,
    recordedBy: { email: 'admin@example.com' },
    createdAt: new Date('2026-03-01').toISOString(),
  }

  it('returns updated reason with unavoidable: true', async () => {
    mockUpdateCancellationReason.mockResolvedValueOnce(mockReason)
    const res = await buildApp('admin').request('/admin/bookings/booking-1/cancellation-reason', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unavoidable: true }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateCancellationReason).toHaveBeenCalledWith('booking-1', true)
    const body = await res.json() as CancellationReasonResponse
    expect(body.unavoidable).toBe(true)
  })

  it('accepts unavoidable: null', async () => {
    mockUpdateCancellationReason.mockResolvedValueOnce({ ...mockReason, unavoidable: null })
    const res = await buildApp('admin').request('/admin/bookings/booking-1/cancellation-reason', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unavoidable: null }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateCancellationReason).toHaveBeenCalledWith('booking-1', null)
  })

  it('returns 404 when cancellation reason not found', async () => {
    mockUpdateCancellationReason.mockResolvedValueOnce(null)
    const res = await buildApp('admin').request('/admin/bookings/booking-1/cancellation-reason', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unavoidable: false }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for missing unavoidable field', async () => {
    const res = await buildApp('admin').request('/admin/bookings/booking-1/cancellation-reason', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp('admin').request('/admin/bookings/booking-1/cancellation-reason', {
      method: 'PATCH',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /admin/bookings/:bookingId/status', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockBookingStatus: AdminBookingStatusResponse = { id: 'booking-1', status: 'waitlist' }

  it('returns 403 for buddy role', async () => {
    const res = await buildApp('buddy').request('/admin/bookings/booking-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin role', async () => {
    const res = await buildApp('other').request('/admin/bookings/booking-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns updated booking status', async () => {
    mockUpdateAdminBookingStatus.mockResolvedValueOnce(mockBookingStatus)
    const res = await buildApp('admin').request('/admin/bookings/booking-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'waitlist' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateAdminBookingStatus).toHaveBeenCalledWith('booking-1', 'waitlist')
    const body = await res.json() as AdminBookingStatusResponse
    expect(body.status).toBe('waitlist')
  })

  it('accepts all valid booking statuses', async () => {
    for (const status of ['confirmed', 'maybe', 'waitlist', 'declined'] as const) {
      mockUpdateAdminBookingStatus.mockResolvedValueOnce({ id: 'booking-1', status })
      const res = await buildApp('admin').request('/admin/bookings/booking-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      expect(res.status).toBe(200)
    }
  })

  it('returns 404 when booking not found', async () => {
    mockUpdateAdminBookingStatus.mockResolvedValueOnce(null)
    const res = await buildApp('admin').request('/admin/bookings/missing/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await buildApp('admin').request('/admin/bookings/booking-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing status field', async () => {
    const res = await buildApp('admin').request('/admin/bookings/booking-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp('admin').request('/admin/bookings/booking-1/status', {
      method: 'PATCH',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})
