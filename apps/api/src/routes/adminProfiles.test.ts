import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminProfileRoutes } from './adminProfiles'
import type { AuthEnv, DbUser } from '../types'
import type { AdminProfileResponse } from '@peace-buddy/types'

vi.mock('../services/adminProfile.service', () => ({
  getAdminProfile: vi.fn(),
  listAdminProfiles: vi.fn(),
  createAdminProfile: vi.fn(),
  updateAdminProfile: vi.fn(),
  softDeleteAdminProfile: vi.fn(),
}))

import {
  getAdminProfile,
  listAdminProfiles,
  createAdminProfile,
  updateAdminProfile,
  softDeleteAdminProfile,
} from '../services/adminProfile.service'

const mockGetAdminProfile = vi.mocked(getAdminProfile)
const mockListAdminProfiles = vi.mocked(listAdminProfiles)
const mockCreateAdminProfile = vi.mocked(createAdminProfile)
const mockUpdateAdminProfile = vi.mocked(updateAdminProfile)
const mockSoftDeleteAdminProfile = vi.mocked(softDeleteAdminProfile)

const stubAdminProfile: AdminProfileResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000010',
  name: 'John Admin',
  createdAt: '2026-01-15T00:00:00Z',
}

const superAdminId = '00000000-0000-0000-0000-000000000020'

const adminUser: DbUser = {
  id: '00000000-0000-0000-0000-000000000010',
  firebaseUid: 'uid-1',
  email: 'admin@example.com',
  role: 'admin',
}

const superAdminUser: DbUser = {
  id: superAdminId,
  firebaseUid: 'uid-super',
  email: 'super@example.com',
  role: 'super_admin',
}

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('user', adminUser)
    return next()
  })
  app.route('/', adminProfileRoutes)
  return app
}

function buildSuperAdminApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('user', superAdminUser)
    return next()
  })
  app.route('/', adminProfileRoutes)
  return app
}

describe('adminProfiles routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /profile', () => {
    it('returns current admin profile', async () => {
      mockGetAdminProfile.mockResolvedValue(stubAdminProfile)
      const app = buildApp()
      const res = await app.request('/profile')
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      expect(body).toEqual(stubAdminProfile)
      expect(mockGetAdminProfile).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000010')
    })

    it('returns 404 if profile not found', async () => {
      mockGetAdminProfile.mockResolvedValue(null)
      const app = buildApp()
      const res = await app.request('/profile')
      expect(res.status).toBe(404)
    })

    it('returns 403 if not admin', async () => {
      const app = new Hono<AuthEnv>()
      const buddyUser: DbUser = { id: 'buddy-1', firebaseUid: 'uid-buddy', email: 'buddy@example.com', role: 'buddy' }
      app.use('*', (c, next) => {
        c.set('user', buddyUser)
        return next()
      })
      app.route('/', adminProfileRoutes)
      const res = await app.request('/profile')
      expect(res.status).toBe(403)
    })
  })

  describe('GET /profiles', () => {
    it('returns list of active admin profiles', async () => {
      mockListAdminProfiles.mockResolvedValue([stubAdminProfile])
      const app = buildApp()
      const res = await app.request('/profiles')
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      expect(body).toEqual([stubAdminProfile])
    })

    it('returns empty array if no profiles', async () => {
      mockListAdminProfiles.mockResolvedValue([])
      const app = buildApp()
      const res = await app.request('/profiles')
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      expect(body).toEqual([])
    })

    it('returns 403 if not admin', async () => {
      const app = new Hono<AuthEnv>()
      const buddyUser: DbUser = { id: 'buddy-1', firebaseUid: 'uid-buddy', email: 'buddy@example.com', role: 'buddy' }
      app.use('*', (c, next) => {
        c.set('user', buddyUser)
        return next()
      })
      app.route('/', adminProfileRoutes)
      const res = await app.request('/profiles')
      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /profile', () => {
    it('updates current admin profile name', async () => {
      mockUpdateAdminProfile.mockResolvedValue({ ...stubAdminProfile, name: 'John Updated' })
      const app = buildApp()
      const res = await app.request('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John Updated' }),
      })
      expect(res.status).toBe(200)
      expect(mockUpdateAdminProfile).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000010', 'John Updated')
    })

    it('returns 400 for invalid JSON', async () => {
      const app = buildApp()
      const res = await app.request('/profile', {
        method: 'PATCH',
        body: 'invalid',
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 if profile not found', async () => {
      mockUpdateAdminProfile.mockResolvedValue(null)
      const app = buildApp()
      const res = await app.request('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John Updated' }),
      })
      expect(res.status).toBe(404)
    })

    it('returns 403 if not admin', async () => {
      const app = new Hono<AuthEnv>()
      const buddyUser: DbUser = { id: 'buddy-1', firebaseUid: 'uid-buddy', email: 'buddy@example.com', role: 'buddy' }
      app.use('*', (c, next) => {
        c.set('user', buddyUser)
        return next()
      })
      app.route('/', adminProfileRoutes)
      const res = await app.request('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John Updated' }),
      })
      expect(res.status).toBe(403)
    })

    it('returns 400 for missing required name', async () => {
      const app = buildApp()
      const res = await app.request('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /profiles', () => {
    it('creates new admin profile (super_admin only)', async () => {
      mockCreateAdminProfile.mockResolvedValue(stubAdminProfile)
      const app = buildSuperAdminApp()
      const res = await app.request('/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000010', name: 'John Admin' }),
      })
      expect(res.status).toBe(201)
      expect(mockCreateAdminProfile).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000010', 'John Admin')
    })

    it('returns 403 if not super_admin', async () => {
      const app = buildApp()
      const res = await app.request('/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000010', name: 'John Admin' }),
      })
      expect(res.status).toBe(403)
    })

    it('returns 409 if admin already exists', async () => {
      mockCreateAdminProfile.mockResolvedValue(null)
      const app = buildSuperAdminApp()
      const res = await app.request('/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000010', name: 'John Admin' }),
      })
      expect(res.status).toBe(409)
    })

    it('returns 400 for invalid request body', async () => {
      const app = buildSuperAdminApp()
      const res = await app.request('/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'invalid', name: 'John' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /profiles/:userId', () => {
    it('soft deletes admin profile (super_admin only)', async () => {
      mockSoftDeleteAdminProfile.mockResolvedValue(stubAdminProfile)
      const app = buildSuperAdminApp()
      const res = await app.request('/profiles/00000000-0000-0000-0000-000000000010', {
        method: 'DELETE',
      })
      expect(res.status).toBe(200)
      expect(mockSoftDeleteAdminProfile).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000010')
    })

    it('returns 403 if not super_admin', async () => {
      const app = buildApp()
      const res = await app.request('/profiles/00000000-0000-0000-0000-000000000010', {
        method: 'DELETE',
      })
      expect(res.status).toBe(403)
    })

    it('prevents self-deletion', async () => {
      const app = buildSuperAdminApp()
      const res = await app.request(`/profiles/${superAdminId}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(400)
      expect(mockSoftDeleteAdminProfile).not.toHaveBeenCalled()
    })

    it('returns 404 if profile not found', async () => {
      mockSoftDeleteAdminProfile.mockResolvedValue(null)
      const app = buildSuperAdminApp()
      const res = await app.request('/profiles/00000000-0000-0000-0000-000000000010', {
        method: 'DELETE',
      })
      expect(res.status).toBe(404)
    })
  })
})
