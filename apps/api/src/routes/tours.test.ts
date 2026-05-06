import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { tourRoutes } from './tours'
import type { AuthEnv } from '../types'
import { BookingStatusSchema } from '@peace-buddy/types'
import type { TourResponse, TourDetailResponse, BookingResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/tour.service', () => ({
  listTours: vi.fn(),
  getTour: vi.fn(),
}))

vi.mock('../services/booking.service', () => ({
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
}))

import { listTours, getTour } from '../services/tour.service'
import { createBooking, updateBooking } from '../services/booking.service'

const mockListTours = vi.mocked(listTours)
const mockGetTour = vi.mocked(getTour)
const mockCreateBooking = vi.mocked(createBooking)
const mockUpdateBooking = vi.mocked(updateBooking)

const dbUser = { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role: 'buddy' }

const mockBooking: BookingResponse = {
  id: 'booking-1',
  tourId: 'tour-1',
  buddyTier: 'junior',
  status: BookingStatusSchema.enum.confirmed,
  bookedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockTour: TourResponse = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: '2026-05-01T00:00:00.000Z',
  meetingTime: '1970-01-01T09:00:00.000Z',
  startTime: null,
  endTime: null,
  bookingOpen: true,
  location: 'Tokyo Station',
  capacity: 10,
  participantCount: 0,
  description: null,
  cancellationDeadline: '2026-04-28T00:00:00.000Z',
  maybeDeadline: null,
  notificationOffsets: [7, 3],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockTourDetail: TourDetailResponse = {
  ...mockTour,
  seatCounts: { confirmed: 2, maybe: 1, waitlist: 0, declined: 0 },
  remaining: 8,
  myCapacity: 7,
  myRemaining: 6,
  myBookingStatus: 'confirmed',
}

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: dbUser.firebaseUid, email: dbUser.email })
    c.set('user', dbUser)
    return next()
  })
  app.route('/tours', tourRoutes)
  return app
}

describe('GET /tours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/tours')
    expect(res.status).toBe(401)
  })

  it('returns 200 with tours', async () => {
    mockListTours.mockResolvedValueOnce([mockTour])
    const res = await buildApp().request('/tours')
    expect(res.status).toBe(200)
    const body = await res.json() as TourResponse[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('tour-1')
  })

  it('returns empty array when no tours', async () => {
    mockListTours.mockResolvedValueOnce([])
    const res = await buildApp().request('/tours')
    expect(res.status).toBe(200)
    const body = await res.json() as TourResponse[]
    expect(body).toEqual([])
  })

  it('passes status query param to listTours', async () => {
    mockListTours.mockResolvedValueOnce([])
    await buildApp().request('/tours?status=completed')
    expect(mockListTours).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ status: 'completed' })
    )
  })

  it('passes from/to date params to listTours', async () => {
    mockListTours.mockResolvedValueOnce([])
    await buildApp().request('/tours?from=2026-05-01&to=2026-05-31')
    expect(mockListTours).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        from: new Date('2026-05-01'),
        to: new Date('2026-05-31'),
      })
    )
  })

  it('returns 400 for invalid status value', async () => {
    const res = await buildApp().request('/tours?status=invalid')
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid query params')
  })
})

describe('GET /tours/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/tours/tour-1')
    expect(res.status).toBe(401)
  })

  it('returns 200 with tour detail', async () => {
    mockGetTour.mockResolvedValueOnce(mockTourDetail)
    const res = await buildApp().request('/tours/tour-1')
    expect(res.status).toBe(200)
    const body = await res.json() as TourDetailResponse
    expect(body.id).toBe('tour-1')
    expect(body.seatCounts).toEqual({ confirmed: 2, maybe: 1, waitlist: 0, declined: 0 })
    expect(body.remaining).toBe(8)
    expect(body.myBookingStatus).toBe('confirmed')
  })

  it('returns 404 when tour not found', async () => {
    mockGetTour.mockResolvedValueOnce(null)
    const res = await buildApp().request('/tours/nonexistent')
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Tour not found')
  })

  it('passes tour id and user id to getTour', async () => {
    mockGetTour.mockResolvedValueOnce(mockTourDetail)
    await buildApp().request('/tours/tour-1')
    expect(mockGetTour).toHaveBeenCalledWith('tour-1', dbUser.id)
  })

  it('does not expose adminMemo in response', async () => {
    mockGetTour.mockResolvedValueOnce(mockTourDetail)
    const res = await buildApp().request('/tours/tour-1')
    const body = await res.json() as Record<string, unknown>
    expect(body.adminMemo).toBeUndefined()
  })
})

describe('POST /tours/:id/bookings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/tours/tour-1/bookings', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('returns 201 with booking on success', async () => {
    mockCreateBooking.mockResolvedValueOnce({ ok: true, booking: mockBooking })
    const res = await buildApp().request('/tours/tour-1/bookings', { method: 'POST' })
    expect(res.status).toBe(201)
    const body = await res.json() as BookingResponse
    expect(body.id).toBe('booking-1')
    expect(body.status).toBe('confirmed')
  })

  it('returns 404 when tour not found', async () => {
    mockCreateBooking.mockResolvedValueOnce({ ok: false, code: 'TOUR_NOT_FOUND' })
    const res = await buildApp().request('/tours/tour-1/bookings', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('returns 409 when already booked', async () => {
    mockCreateBooking.mockResolvedValueOnce({ ok: false, code: 'ALREADY_BOOKED' })
    const res = await buildApp().request('/tours/tour-1/bookings', { method: 'POST' })
    expect(res.status).toBe(409)
  })

  it('returns 422 when tour is not bookable', async () => {
    mockCreateBooking.mockResolvedValueOnce({ ok: false, code: 'NOT_BOOKABLE' })
    const res = await buildApp().request('/tours/tour-1/bookings', { method: 'POST' })
    expect(res.status).toBe(422)
  })

  it('returns 403 when buddy is not eligible', async () => {
    mockCreateBooking.mockResolvedValueOnce({ ok: false, code: 'NOT_ELIGIBLE' })
    const res = await buildApp().request('/tours/tour-1/bookings', { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('passes tourId and userId to createBooking', async () => {
    mockCreateBooking.mockResolvedValueOnce({ ok: true, booking: mockBooking })
    await buildApp().request('/tours/tour-1/bookings', { method: 'POST' })
    expect(mockCreateBooking).toHaveBeenCalledWith('tour-1', dbUser.id)
  })
})

describe('PUT /tours/:id/bookings/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 200 with updated booking', async () => {
    mockUpdateBooking.mockResolvedValueOnce({ ok: true, booking: { ...mockBooking, status: 'maybe' } })
    const res = await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'maybe' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as BookingResponse
    expect(body.status).toBe('maybe')
  })

  it('returns 400 for invalid status in body', async () => {
    const res = await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid_status' }),
    })
    expect(res.status).toBe(400)
  })

  it('accepts waitlist as a valid status', async () => {
    mockUpdateBooking.mockResolvedValueOnce({ ok: true, booking: { ...mockBooking, status: 'waitlist' } })
    const res = await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'waitlist' }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 when booking not found', async () => {
    mockUpdateBooking.mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND' })
    const res = await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 409 when tour is full', async () => {
    mockUpdateBooking.mockResolvedValueOnce({ ok: false, code: 'TOUR_FULL' })
    const res = await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(res.status).toBe(409)
  })

  it('returns 422 when deadline has passed', async () => {
    mockUpdateBooking.mockResolvedValueOnce({ ok: false, code: 'DEADLINE_PASSED' })
    const res = await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
    expect(res.status).toBe(422)
  })

  it('returns 400 when reason is required', async () => {
    mockUpdateBooking.mockResolvedValueOnce({ ok: false, code: 'REASON_REQUIRED' })
    const res = await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
    expect(res.status).toBe(400)
  })

  it('passes tourId, userId, status, and reason to updateBooking', async () => {
    const reason = { category: 'health', unavoidable: false }
    mockUpdateBooking.mockResolvedValueOnce({ ok: true, booking: mockBooking })
    await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined', reason }),
    })
    expect(mockUpdateBooking).toHaveBeenCalledWith('tour-1', dbUser.id, 'declined', reason)
  })

  it('passes undefined reason when not provided', async () => {
    mockUpdateBooking.mockResolvedValueOnce({ ok: true, booking: mockBooking })
    await buildApp().request('/tours/tour-1/bookings/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'maybe' }),
    })
    expect(mockUpdateBooking).toHaveBeenCalledWith('tour-1', dbUser.id, 'maybe', undefined)
  })
})
