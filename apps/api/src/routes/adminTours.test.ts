import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { AdminTourSummaryResponse, AdminTourDetailResponse, TierCapacities, TourSessionResponse } from '@peace-buddy/types'

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

vi.mock('../services/adminReflectionStats.service', () => ({
  listReflectionStats: vi.fn(),
}))

vi.mock('../services/adminReflection.service', () => ({
  listReflections: vi.fn(),
  getReflection: vi.fn(),
}))

vi.mock('../services/adminTour.service', () => ({
  listAdminTours: vi.fn(),
  createTour: vi.fn(),
  getAdminTourDetail: vi.fn(),
  updateTour: vi.fn(),
  transitionTourStatus: vi.fn(),
  deleteTour: vi.fn(),
  getAdminTourIcs: vi.fn(),
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

vi.mock('../services/adminSession.service', () => ({
  addSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  getSessionTierCapacities: vi.fn(),
  upsertSessionTierCapacities: vi.fn(),
  SessionNotFoundError: class SessionNotFoundError extends Error {
    constructor() { super('Session not found') }
  },
  SessionHasBookingsError: class SessionHasBookingsError extends Error {
    constructor() { super('Cannot delete session with bookings') }
  },
  LastSessionError: class LastSessionError extends Error {
    constructor() { super('Cannot delete the only session') }
  },
  TooManySessionsError: class TooManySessionsError extends Error {
    constructor() { super('Tour already has maximum number of sessions') }
  },
  PlaceInUseError: class PlaceInUseError extends Error {
    constructor() { super('A moment on this session uses a spot of its place, so the place cannot be changed') }
  },
  CapacityBelowConfirmedError: class CapacityBelowConfirmedError extends Error {
    constructor() { super('Capacity cannot be lower than the number of confirmed bookings on this session') }
  },
  MinBuddiesExceedsCapacityError: class MinBuddiesExceedsCapacityError extends Error {
    constructor() { super('minBuddies must be ≤ capacity') }
  },
}))

vi.mock('../services/tourAdminAssignment.service', () => ({
  assignAdmin: vi.fn(),
  unassignAdmin: vi.fn(),
  setStaffInCharge: vi.fn(),
  AdminNotFoundError: class AdminNotFoundError extends Error {},
  AdminAlreadyAssignedError: class AdminAlreadyAssignedError extends Error {},
  AdminNotAssignedError: class AdminNotAssignedError extends Error {},
  StaffInChargeNotAssignedError: class StaffInChargeNotAssignedError extends Error {},
  StaffInChargeRequiresReplacementError: class StaffInChargeRequiresReplacementError extends Error {},
  StaffInChargeRequiredError: class StaffInChargeRequiredError extends Error {},
}))

import {
  listAdminTours,
  createTour,
  getAdminTourDetail,
  updateTour,
  transitionTourStatus,
  deleteTour,
  getAdminTourIcs,
  TourNotFoundError,
  TourTransitionError,
  TourImmutableError,
  TourNotDraftError,
} from '../services/adminTour.service'
import {
  addSession,
  updateSession,
  deleteSession,
  getSessionTierCapacities,
  upsertSessionTierCapacities,
  SessionNotFoundError,
  SessionHasBookingsError,
  LastSessionError,
  TooManySessionsError,
  PlaceInUseError,
  CapacityBelowConfirmedError,
  MinBuddiesExceedsCapacityError,
} from '../services/adminSession.service'
import {
  assignAdmin,
  unassignAdmin,
  setStaffInCharge,
  AdminNotFoundError,
  AdminAlreadyAssignedError,
  AdminNotAssignedError,
  StaffInChargeNotAssignedError,
  StaffInChargeRequiresReplacementError,
  StaffInChargeRequiredError,
} from '../services/tourAdminAssignment.service'

const mockListAdminTours = vi.mocked(listAdminTours)
const mockCreateTour = vi.mocked(createTour)
const mockGetAdminTourDetail = vi.mocked(getAdminTourDetail)
const mockGetAdminTourIcs = vi.mocked(getAdminTourIcs)
const mockUpdateTour = vi.mocked(updateTour)
const mockTransitionTourStatus = vi.mocked(transitionTourStatus)
const mockDeleteTour = vi.mocked(deleteTour)
const mockAddSession = vi.mocked(addSession)
const mockUpdateSession = vi.mocked(updateSession)
const mockDeleteSession = vi.mocked(deleteSession)
const mockGetSessionTierCapacities = vi.mocked(getSessionTierCapacities)
const mockUpsertSessionTierCapacities = vi.mocked(upsertSessionTierCapacities)
const mockAssignAdmin = vi.mocked(assignAdmin)
const mockUnassignAdmin = vi.mocked(unassignAdmin)
const mockSetStaffInCharge = vi.mocked(setStaffInCharge)

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

const mockSession: TourSessionResponse = {
  id: 'session-1',
  order: 1,
  label: null,
  meetingTime: '1970-01-01T09:00:00.000Z',
  startTime: null,
  endTime: null,
  capacity: 5,
  minBuddies: 3,
  participantCount: 0,
  place: { id: 'place-1', nameJa: '東京駅', nameEn: 'Tokyo Station' },
}

const mockSummary: AdminTourSummaryResponse = {
  id: 'tour-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'draft',
  tourDate: '2026-06-01T00:00:00.000Z',
  bookingOpen: false,
  places: [{ id: 'place-1', nameJa: '東京駅', nameEn: 'Tokyo Station' }],
  capacity: 5,
  description: null,
  confirmedCount: 0,
  participantCount: 0,
  sessions: [mockSession],
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
  assignedAdmins: [],
  staffInChargeId: null,
}

const validCreateBody = {
  groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tourDate: '2026-06-01',
  cancellationDeadline: '2026-05-25',
  notificationOffsets: [3, 1],
  sessions: [{ meetingTime: '09:00', capacity: 5, minBuddies: 3, placeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
}

const validSessionBody = { meetingTime: '10:00', capacity: 8, minBuddies: 6, placeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }

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

  it('returns 400 when sessions array is empty', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreateBody, sessions: [] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 when a session has no place', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreateBody, sessions: [{ meetingTime: '09:00', capacity: 5 }] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
    expect(mockCreateTour).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid meetingTime format in session', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreateBody, sessions: [{ meetingTime: '9:00am', capacity: 5 }] }),
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

  it('returns 400 when session minBuddies exceeds capacity', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validCreateBody,
        sessions: [{ meetingTime: '09:00', capacity: 5, minBuddies: 10 }],
      }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
    expect(mockCreateTour).not.toHaveBeenCalled()
  })

  it('accepts session with minBuddies equal to capacity', async () => {
    mockCreateTour.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validCreateBody,
        sessions: [{ meetingTime: '09:00', capacity: 5, minBuddies: 5, placeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
      }),
    })
    expect(res.status).toBe(201)
    expect(mockCreateTour).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: expect.arrayContaining([expect.objectContaining({ minBuddies: 5 })]) as unknown as Array<{ minBuddies: number }>,
      }),
    )
  })

  it('returns 400 when session minBuddies is negative', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validCreateBody,
        sessions: [{ meetingTime: '09:00', capacity: 5, minBuddies: -1 }],
      }),
    })
    expect(res.status).toBe(400)
    expect(mockCreateTour).not.toHaveBeenCalled()
  })

  it('returns 400 when a session has no minBuddies', async () => {
    const res = await buildApp().request('/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validCreateBody,
        sessions: [{ meetingTime: '09:00', capacity: 5, placeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
      }),
    })
    expect(res.status).toBe(400)
    expect(mockCreateTour).not.toHaveBeenCalled()
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

describe('GET /admin/tours/:id/calendar.ics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the .ics body with calendar headers', async () => {
    mockGetAdminTourIcs.mockResolvedValueOnce('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')
    const res = await buildApp().request('/admin/tours/tour-1/calendar.ics')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="tour-tour-1.ics"')
    expect(await res.text()).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')
  })

  it('returns 404 with code when not found', async () => {
    mockGetAdminTourIcs.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/tours/missing/calendar.ics')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })
})

describe('PUT /admin/tours/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a tour', async () => {
    mockUpdateTour.mockResolvedValueOnce({ ...mockDetail, bookingOpen: true })
    const res = await buildApp().request('/admin/tours/tour-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingOpen: true }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateTour).toHaveBeenCalledWith(
      'tour-1',
      expect.objectContaining({ bookingOpen: true })
    )
  })

  it('returns 404 with code when tour not found', async () => {
    mockUpdateTour.mockRejectedValueOnce(new TourNotFoundError())
    const res = await buildApp().request('/admin/tours/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingOpen: true }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 with code when tour is immutable', async () => {
    mockUpdateTour.mockRejectedValueOnce(new TourImmutableError())
    const res = await buildApp().request('/admin/tours/tour-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingOpen: true }),
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
    mockTransitionTourStatus.mockRejectedValueOnce(new TourTransitionError("Cannot transition"))
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

// ── Session management ──────────────────────────────────────────────────────

describe('POST /admin/tours/:id/sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a session and returns 201', async () => {
    mockAddSession.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSessionBody),
    })
    expect(res.status).toBe(201)
    expect(mockAddSession).toHaveBeenCalledWith('tour-1', expect.objectContaining({ meetingTime: '10:00', capacity: 8 }))
  })

  it('returns 400 for invalid meetingTime format', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingTime: 'bad-time', capacity: 5 }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 for missing capacity', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingTime: '09:00' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 404 when tour not found', async () => {
    mockAddSession.mockRejectedValueOnce(new TourNotFoundError())
    const res = await buildApp().request('/admin/tours/missing/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSessionBody),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 when tour is immutable', async () => {
    mockAddSession.mockRejectedValueOnce(new TourImmutableError())
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSessionBody),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 409 when tour already has max sessions', async () => {
    mockAddSession.mockRejectedValueOnce(new TooManySessionsError())
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSessionBody),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 when minBuddies exceeds capacity', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validSessionBody, capacity: 5, minBuddies: 6 }),
    })
    expect(res.status).toBe(400)
    expect(mockAddSession).not.toHaveBeenCalled()
  })

  it('returns 400 when placeId is missing', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingTime: '10:00', capacity: 8 }),
    })
    expect(res.status).toBe(400)
    expect(mockAddSession).not.toHaveBeenCalled()
  })

  it('forwards minBuddies to the service when valid', async () => {
    mockAddSession.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validSessionBody, minBuddies: 3 }),
    })
    expect(res.status).toBe(201)
    expect(mockAddSession).toHaveBeenCalledWith(
      'tour-1',
      expect.objectContaining({ minBuddies: 3 }),
    )
  })
})

describe('PUT /admin/tours/:id/sessions/:sessionId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a session and returns 200', async () => {
    mockUpdateSession.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity: 10 }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateSession).toHaveBeenCalledWith('tour-1', 'session-1', expect.objectContaining({ capacity: 10 }))
  })

  it('returns 404 when session not found', async () => {
    mockUpdateSession.mockRejectedValueOnce(new SessionNotFoundError())
    const res = await buildApp().request('/admin/tours/tour-1/sessions/bad-session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity: 10 }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('forwards a place change to the service', async () => {
    mockUpdateSession.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateSession).toHaveBeenCalledWith('tour-1', 'session-1', expect.objectContaining({ placeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }))
  })

  it('returns 409 with detail when a moment still uses a spot of the old place', async () => {
    const error = new PlaceInUseError()
    mockUpdateSession.mockRejectedValueOnce(error)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict', detail: error.message })
  })

  it('returns 409 with detail when capacity drops below the confirmed bookings', async () => {
    const error = new CapacityBelowConfirmedError()
    mockUpdateSession.mockRejectedValueOnce(error)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity: 1 }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict', detail: error.message })
  })

  it('returns 400 with detail when minBuddies would exceed the stored capacity', async () => {
    const error = new MinBuddiesExceedsCapacityError()
    mockUpdateSession.mockRejectedValueOnce(error)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minBuddies: 11 }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request', detail: error.message })
  })

  it('returns 400 for a non-uuid placeId', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: 'not-a-uuid' }),
    })
    expect(res.status).toBe(400)
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid meetingTime format', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingTime: 'bad' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 when minBuddies exceeds the updated capacity', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity: 5, minBuddies: 10 }),
    })
    expect(res.status).toBe(400)
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('accepts minBuddies-only update without capacity (refine skipped)', async () => {
    mockUpdateSession.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minBuddies: 99 }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateSession).toHaveBeenCalledWith(
      'tour-1',
      'session-1',
      expect.objectContaining({ minBuddies: 99 }),
    )
  })

  it('rejects null minBuddies: a session always has one', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minBuddies: null }),
    })
    expect(res.status).toBe(400)
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('rejects minBuddies of 0', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minBuddies: 0 }),
    })
    expect(res.status).toBe(400)
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })
})

describe('DELETE /admin/tours/:id/sessions/:sessionId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a session and returns 200 with updated tour', async () => {
    mockDeleteSession.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(mockDeleteSession).toHaveBeenCalledWith('tour-1', 'session-1')
  })

  it('returns 404 when session not found', async () => {
    mockDeleteSession.mockRejectedValueOnce(new SessionNotFoundError())
    const res = await buildApp().request('/admin/tours/tour-1/sessions/bad-session', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 when session has bookings', async () => {
    mockDeleteSession.mockRejectedValueOnce(new SessionHasBookingsError())
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 409 when session is the last one', async () => {
    mockDeleteSession.mockRejectedValueOnce(new LastSessionError())
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1', { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })
})

// ── Session-scoped tier capacities ──────────────────────────────────────────

const stubCapacities: TierCapacities = { junior: 20, non_junior: 30, anyone: 50 }

describe('GET /admin/tours/:id/sessions/:sessionId/tier-capacities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with tier capacities', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce({ ...mockDetail, sessions: [{ ...mockSession, id: 'session-1' }] })
    mockGetSessionTierCapacities.mockResolvedValueOnce(stubCapacities)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1/tier-capacities')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(stubCapacities)
    expect(mockGetSessionTierCapacities).toHaveBeenCalledWith('session-1')
  })

  it('returns 404 when tour not found', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/tours/missing/sessions/session-1/tier-capacities')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 404 when session not in tour', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce({ ...mockDetail, sessions: [{ ...mockSession, id: 'other-session' }] })
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1/tier-capacities')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })
})

describe('PATCH /admin/tours/:id/sessions/:sessionId/tier-capacities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with updated capacities on success', async () => {
    mockUpsertSessionTierCapacities.mockResolvedValueOnce(stubCapacities)
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1/tier-capacities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stubCapacities),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(stubCapacities)
    expect(mockUpsertSessionTierCapacities).toHaveBeenCalledWith('tour-1', 'session-1', stubCapacities)
  })

  it('returns 400 for invalid body (missing field)', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1/tier-capacities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ junior: 50, non_junior: 50 }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 when percents do not sum to 100', async () => {
    const res = await buildApp().request('/admin/tours/tour-1/sessions/session-1/tier-capacities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ junior: 10, non_junior: 10, anyone: 10 }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 404 when session not found', async () => {
    mockUpsertSessionTierCapacities.mockRejectedValueOnce(new SessionNotFoundError())
    const res = await buildApp().request('/admin/tours/tour-1/sessions/bad-session/tier-capacities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stubCapacities),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })
})

describe('POST /admin/tours/:id/admins', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assigns an admin and returns 200 with updated tour', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    mockAssignAdmin.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(200)
    expect(mockAssignAdmin).toHaveBeenCalledWith('tour-1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('returns 404 when tour does not exist', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/tours/bad-tour/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 404 when admin does not exist', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    mockAssignAdmin.mockRejectedValueOnce(new AdminNotFoundError())
    const res = await buildApp().request('/admin/tours/tour-1/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 404 when tour is gone in the race window (TourNotFoundError)', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    mockAssignAdmin.mockRejectedValueOnce(new TourNotFoundError())
    const res = await buildApp().request('/admin/tours/tour-1/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 when admin is already assigned', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    mockAssignAdmin.mockRejectedValueOnce(new AdminAlreadyAssignedError())
    const res = await buildApp().request('/admin/tours/tour-1/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 400 when adminId is not a UUID', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'not-a-uuid' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 for non-JSON body', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/admins', {
      method: 'POST',
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })
})

describe('DELETE /admin/tours/:id/admins/:adminId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unassigns an admin and returns 200 with updated tour', async () => {
    mockUnassignAdmin.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/admins/ap-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(mockUnassignAdmin).toHaveBeenCalledWith('tour-1', 'ap-1')
  })

  it('returns 404 when assignment does not exist', async () => {
    mockUnassignAdmin.mockRejectedValueOnce(new AdminNotAssignedError())
    const res = await buildApp().request('/admin/tours/tour-1/admins/ap-1', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 when removing staff-in-charge while other admins remain', async () => {
    mockUnassignAdmin.mockRejectedValueOnce(new StaffInChargeRequiresReplacementError())
    const res = await buildApp().request('/admin/tours/tour-1/admins/ap-1', { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })
})

describe('PUT /admin/tours/:id/staff-in-charge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets staff-in-charge and returns 200 with updated tour', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    mockSetStaffInCharge.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/staff-in-charge', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(200)
    expect(mockSetStaffInCharge).toHaveBeenCalledWith('tour-1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('returns 404 when tour does not exist', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/tours/bad-tour/staff-in-charge', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 409 when admin is not assigned to the tour', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    mockSetStaffInCharge.mockRejectedValueOnce(new StaffInChargeNotAssignedError())
    const res = await buildApp().request('/admin/tours/tour-1/staff-in-charge', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 409 when clearing staff-in-charge while admins are assigned', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    mockSetStaffInCharge.mockRejectedValueOnce(new StaffInChargeRequiredError())
    const res = await buildApp().request('/admin/tours/tour-1/staff-in-charge', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: null }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'conflict' })
  })

  it('returns 400 when adminId is not a UUID or null', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/staff-in-charge', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'not-a-uuid' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })

  it('returns 400 for non-JSON body', async () => {
    mockGetAdminTourDetail.mockResolvedValueOnce(mockDetail)
    const res = await buildApp().request('/admin/tours/tour-1/staff-in-charge', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_request' })
  })
})
