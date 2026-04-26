import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { AdminTourSummaryResponse, AdminTourDetailResponse } from '@peace-buddy/types'

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
  TourNotFoundError: class TourNotFoundError extends Error {
    constructor() { super('Tour not found') }
  },
  TourTransitionError: class TourTransitionError extends Error {},
  TourImmutableError: class TourImmutableError extends Error {
    constructor() { super('Cannot edit a cancelled or completed tour') }
  },
  TourNotDraftError: class TourNotDraftError extends Error {
    constructor() { super('Only draft tours can be deleted') }
  },
}))

import {
  listAdminTours,
  createTour,
  getAdminTourDetail,
  updateTour,
  transitionTourStatus,
  deleteTour,
  TourNotFoundError,
  TourTransitionError,
  TourImmutableError,
  TourNotDraftError,
} from '../services/adminTour.service'

const mockListAdminTours = vi.mocked(listAdminTours)
const mockCreateTour = vi.mocked(createTour)
const mockGetAdminTourDetail = vi.mocked(getAdminTourDetail)
const mockUpdateTour = vi.mocked(updateTour)
const mockTransitionTourStatus = vi.mocked(transitionTourStatus)
const mockDeleteTour = vi.mocked(deleteTour)

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

const mockSummary: AdminTourSummaryResponse = {
  id: 'tour-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'draft',
  tourDate: '2026-06-01T00:00:00.000Z',
  meetingTime: '1970-01-01T09:00:00.000Z',
  startTime: null,
  endTime: null,
  bookingOpen: false,
  location: 'Tokyo Station',
  capacity: 5,
  description: null,
  confirmedCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockDetail: AdminTourDetailResponse = {
  ...mockSummary,
  adminMemo: null,
  cancellationDeadline: '2026-05-25T00:00:00.000Z',
  maybeDeadline: null,
  notificationOffsets: [3, 1],
  bookings: [],
}

const validCreateBody = {
  groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tourDate: '2026-06-01',
  meetingTime: '09:00',
  location: 'Tokyo Station',
  capacity: 5,
  cancellationDeadline: '2026-05-25',
  notificationOffsets: [3, 1],
}

describe('GET /admin/tours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tour list', async () => {
    mockListAdminTours.mockResolvedValueOnce([mockSummary])
    const res = await buildApp().request('/admin/tours')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminTourSummaryResponse[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('tour-1')
    expect(mockListAdminTours).toHaveBeenCalledWith({})
  })

  it('filters by status', async () => {
    mockListAdminTours.mockResolvedValueOnce([])
    const res = await buildApp().request('/admin/tours?status=published')
    expect(res.status).toBe(200)
    expect(mockListAdminTours).toHaveBeenCalledWith({ status: 'published' })
  })

  it('returns 400 for invalid status', async () => {
    const res = await buildApp().request('/admin/tours?status=invalid')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })
})

describe('POST /admin/tours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a tour and returns 201', async () => {
    mockCreateTour.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    expect(res.status).toBe(201)
    expect(mockCreateTour).toHaveBeenCalled()
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: 'Tokyo' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 for invalid meetingTime format', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreateBody, meetingTime: '9:00am' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 when maybeDeadline is not before cancellationDeadline', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validCreateBody,
        maybeDeadline: '2026-05-26',
        cancellationDeadline: '2026-05-25',
      }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })
})

describe('GET /admin/tours/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tour detail', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1')
    expect(res.status).toBe(200)
    const body = await res.json() as AdminTourDetailResponse
    expect(body.id).toBe('tour-1')
    expect(body.bookings).toEqual([])
  })

  it('returns 404 with code when not found', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/tours/missing')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })
})

describe('PUT /admin/tours/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a tour', async () => {
    mockUpdateTour.mockResolvedValueOnce({ ...mockDetail, location: 'Shibuya' })
    const res = await buildApp().request('/admin/tours/tour-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: 'Shibuya' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateTour).toHaveBeenCalledWith('tour-1', expect.objectContaining({ location: 'Shibuya' }))
  })

  it('returns 404 with code when tour not found', async () => {
    mockUpdateTour.mockRejectedValueOnce(new TourNotFoundError())
    const res = await buildApp().request('/admin/tours/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: 'X' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 with code when tour is immutable', async () => {
    mockUpdateTour.mockRejectedValueOnce(new TourImmutableError())
    const res = await buildApp().request('/admin/tours/tour-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: 'X' }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/tours/tour-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })
})

describe('PATCH /admin/tours/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('publishes a draft tour', async () => {
    mockTransitionTourStatus.mockResolvedValueOnce({ ...mockDetail, status: 'published' })
    const res = await buildApp().request('/admin/tours/tour-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    })
    expect(res.status).toBe(200)
    expect(mockTransitionTourStatus).toHaveBeenCalledWith('tour-1', 'publish')
  })

  it('cancels a draft tour', async () => {
    mockTransitionTourStatus.mockResolvedValueOnce({ ...mockDetail, status: 'cancelled' })
    const res = await buildApp().request('/admin/tours/tour-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    expect(res.status).toBe(200)
    expect(mockTransitionTourStatus).toHaveBeenCalledWith('tour-1', 'cancel')
  })

  it('returns 409 with code for invalid transition', async () => {
    mockTransitionTourStatus.mockRejectedValueOnce(new TourTransitionError("Cannot transition from 'cancelled' to 'published'"))
    const res = await buildApp().request('/admin/tours/tour-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 404 with code when tour not found', async () => {
    mockTransitionTourStatus.mockRejectedValueOnce(new TourNotFoundError())
    const res = await buildApp().request('/admin/tours/missing/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 400 for invalid action', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })
})

describe('DELETE /admin/tours/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a draft tour and returns 204', async () => {
    mockDeleteTour.mockResolvedValueOnce(undefined)
    const res = await buildApp().request('/admin/tours/tour-1', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mockDeleteTour).toHaveBeenCalledWith('tour-1')
  })

  it('returns 404 with code when tour not found', async () => {
    mockDeleteTour.mockRejectedValueOnce(new TourNotFoundError())
    const res = await buildApp().request('/admin/tours/missing', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 with code when tour is not draft', async () => {
    mockDeleteTour.mockRejectedValueOnce(new TourNotDraftError())
    const res = await buildApp().request('/admin/tours/tour-1', { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })
})
