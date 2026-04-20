/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { tourRoutes } from './tours'
import type { AuthEnv } from '../types'
import type { TourResponse, TourDetailResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/tour.service', () => ({
  listTours: vi.fn(),
  getTour: vi.fn(),
}))

import { listTours, getTour } from '../services/tour.service'

const mockListTours = vi.mocked(listTours)
const mockGetTour = vi.mocked(getTour)

const dbUser = { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role: 'buddy' }

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
  remainingSeats: 8,
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
      expect.objectContaining({ status: 'completed' })
    )
  })

  it('passes from/to date params to listTours', async () => {
    mockListTours.mockResolvedValueOnce([])
    await buildApp().request('/tours?from=2026-05-01&to=2026-05-31')
    expect(mockListTours).toHaveBeenCalledWith(
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
    expect(body.remainingSeats).toBe(8)
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
