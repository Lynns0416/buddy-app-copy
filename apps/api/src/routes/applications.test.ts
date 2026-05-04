import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { applicationsRoutes } from './applications'
import type { AuthEnv, DbUser } from '../types'

vi.mock('../services/tourApplication.service', () => ({
  createApplication: vi.fn(),
  cancelApplication: vi.fn(),
  getApplicationStatus: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: {
      findUnique: vi.fn(),
    },
    tour: {
      findUnique: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
    },
  },
}))

import { createApplication, cancelApplication, getApplicationStatus } from '../services/tourApplication.service'
import { db } from '../lib/db'

const mockCreateApplication = vi.mocked(createApplication)
const mockCancelApplication = vi.mocked(cancelApplication)
const mockGetApplicationStatus = vi.mocked(getApplicationStatus)

const getDb = () => {
  const typedDb = db as unknown as {
    buddyProfile: {
      findUnique: ReturnType<typeof vi.fn>
    }
    tour: {
      findUnique: ReturnType<typeof vi.fn>
    }
    application: {
      findUnique: ReturnType<typeof vi.fn>
    }
  }
  return typedDb
}

const buddyUser: DbUser = {
  id: '00000000-0000-0000-0000-000000000001',
  firebaseUid: 'uid-buddy',
  email: 'buddy@example.com',
  role: 'buddy',
}

const adminUser: DbUser = {
  id: '00000000-0000-0000-0000-000000000002',
  firebaseUid: 'uid-admin',
  email: 'admin@example.com',
  role: 'admin',
}

function buildApp(user: DbUser = buddyUser) {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('user', user)
    return next()
  })
  app.route('/', applicationsRoutes)
  return app
}

describe('applications routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /', () => {
    it('creates application for buddy', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        tier: 'junior',
      })
      getDb().tour.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000100',
        status: 'published',
      })
      getDb().application.findUnique.mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000001000',
        tourId: '00000000-0000-0000-0000-000000000100',
        status: 'approved',
        createdAt: new Date('2026-05-03T00:00:00Z'),
        approvedAt: new Date('2026-05-03T00:01:00Z'),
      })
      mockCreateApplication.mockResolvedValue({ ok: true, data: '00000000-0000-0000-0000-000000001000' })

      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(201)
      const body: unknown = await res.json()
      expect(body).toHaveProperty('id', '00000000-0000-0000-0000-000000001000')
      expect(mockCreateApplication).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010', 'junior')
    })

    it('returns 403 if not buddy', async () => {
      const app = buildApp(adminUser)
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(403)
    })

    it('returns 404 if buddy profile not found', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 if buddy tier not set', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        tier: null,
      })

      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 if tour not found', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        tier: 'junior',
      })
      getDb().tour.findUnique.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 403 if buddy is trainee', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        tier: 'trainee',
      })

      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(403)
    })

    it('returns 409 if application already exists and is not rejected', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        tier: 'junior',
      })
      getDb().tour.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000100',
        status: 'published',
      })
      mockCreateApplication.mockResolvedValue({ ok: false, code: 'conflict' })

      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(409)
    })

    it('allows re-apply when existing application is rejected', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        tier: 'junior',
      })
      getDb().tour.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000100',
        status: 'published',
      })
      getDb().application.findUnique.mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000001000',
        tourId: '00000000-0000-0000-0000-000000000100',
        status: 'approved',
        createdAt: new Date('2026-05-03T00:00:00Z'),
        approvedAt: new Date('2026-05-03T00:01:00Z'),
      })
      mockCreateApplication.mockResolvedValue({ ok: true, data: '00000000-0000-0000-0000-000000001000' })

      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: '00000000-0000-0000-0000-000000000100' }),
      })

      expect(res.status).toBe(201)
    })

    it('returns 400 for invalid request body', async () => {
      const app = buildApp()
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId: 'invalid-uuid' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /:id', () => {
    it('cancels application for buddy', async () => {
      getDb().application.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000001000',
        buddyId: '00000000-0000-0000-0000-000000000010',
        buddy: { userId: '00000000-0000-0000-0000-000000000001' },
      })
      mockCancelApplication.mockResolvedValue(undefined)

      const app = buildApp()
      const res = await app.request('/00000000-0000-0000-0000-000000001000', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      expect(mockCancelApplication).toHaveBeenCalledWith('00000000-0000-0000-0000-000000001000')
    })

    it('returns 403 if not buddy', async () => {
      const app = buildApp(adminUser)
      const res = await app.request('/00000000-0000-0000-0000-000000001000', {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
    })

    it('returns 403 if not own application', async () => {
      getDb().application.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000001000',
        buddyId: '00000000-0000-0000-0000-000000000010',
        buddy: { userId: '00000000-0000-0000-0000-000000000099' },
      })

      const app = buildApp()
      const res = await app.request('/00000000-0000-0000-0000-000000001000', {
        method: 'DELETE',
      })

      expect(res.status).toBe(403)
    })

    it('returns 404 if application not found', async () => {
      getDb().application.findUnique.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.request('/00000000-0000-0000-0000-000000001000', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /:tourId/status', () => {
    it('returns application status for buddy', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
      })
      mockGetApplicationStatus.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000001000',
        status: 'approved',
        createdAt: new Date('2026-05-03T00:00:00Z'),
        approvedAt: new Date('2026-05-03T01:00:00Z'),
      })

      const app = buildApp()
      const res = await app.request('/00000000-0000-0000-0000-000000000100/status')

      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      expect(body).toHaveProperty('id', '00000000-0000-0000-0000-000000001000')
      expect(body).toHaveProperty('status', 'approved')
    })

    it('returns null if no application found', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
      })
      mockGetApplicationStatus.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.request('/00000000-0000-0000-0000-000000000100/status')

      expect(res.status).toBe(200)
      const body = (await res.json()) as unknown
      expect(body).toBeNull()
    })

    it('returns 403 if not buddy', async () => {
      const app = buildApp(adminUser)
      const res = await app.request('/00000000-0000-0000-0000-000000000100/status')

      expect(res.status).toBe(403)
    })

    it('returns 404 if buddy profile not found', async () => {
      getDb().buddyProfile.findUnique.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.request('/00000000-0000-0000-0000-000000000100/status')

      expect(res.status).toBe(404)
    })
  })
})
