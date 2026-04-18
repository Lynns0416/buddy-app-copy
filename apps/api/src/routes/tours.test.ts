import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { tourRoutes } from './tours'
import type { AuthEnv } from '../types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/tour.service', () => ({
  listTours: vi.fn(),
}))

import { listTours } from '../services/tour.service'

const mockListTours = vi.mocked(listTours)

const dbUser = { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role: 'buddy' }
const mockTour = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: new Date('2026-05-01'),
  meetingTime: new Date('2026-05-01T09:00:00'),
  location: 'Tokyo Station',
  capacity: 10,
  description: null,
  cancellationDeadline: new Date('2026-04-28'),
  maybeDeadline: null,
  notificationOffsets: [7, 3],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

// Builds a test app that bypasses auth and injects a fixed user
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
    mockListTours.mockResolvedValueOnce([mockTour] as any)
    const res = await buildApp().request('/tours')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('tour-1')
  })

  it('returns empty array when no tours', async () => {
    mockListTours.mockResolvedValueOnce([])
    const res = await buildApp().request('/tours')
    expect(res.status).toBe(200)
    const body = await res.json()
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
    const body = await res.json()
    expect(body.error).toBe('Invalid query params')
  })

  // adminMemo exclusion is enforced by Prisma select in tour.service.ts,
  // covered by tour.service.test.ts — not a route-level concern
})
