import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { buddyRoutes } from './buddies'
import type { AuthEnv } from '../types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/buddy.service', () => ({
  getBuddyProfile: vi.fn(),
  updateBuddyProfile: vi.fn(),
}))

import { getBuddyProfile, updateBuddyProfile } from '../services/buddy.service'

const mockGetBuddyProfile = vi.mocked(getBuddyProfile)
const mockUpdateBuddyProfile = vi.mocked(updateBuddyProfile)

const dbUser = { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role: 'buddy' }
const mockProfile = {
  id: 'profile-1',
  status: 'active',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  bio: null,
  contactInfo: null,
  languages: ['en'],
  skills: ['sign language'],
  availability: null,
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
  app.route('/me', buddyRoutes)
  return app
}

describe('GET /me/profile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/me/profile')
    expect(res.status).toBe(401)
  })

  it('returns 404 when profile does not exist', async () => {
    mockGetBuddyProfile.mockResolvedValueOnce(null)
    const res = await buildApp().request('/me/profile')
    expect(res.status).toBe(404)
  })

  it('returns 200 with the profile', async () => {
    mockGetBuddyProfile.mockResolvedValueOnce(mockProfile)
    const res = await buildApp().request('/me/profile')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('profile-1')
    expect(body.displayName).toBe('Test Buddy')
  })

  it('does not expose admin-only fields', async () => {
    mockGetBuddyProfile.mockResolvedValueOnce(mockProfile)
    const res = await buildApp().request('/me/profile')
    const body = await res.json()
    expect(body.internalNotes).toBeUndefined()
    expect(body.tier).toBeUndefined()
  })

  it('calls getBuddyProfile with the db user id', async () => {
    mockGetBuddyProfile.mockResolvedValueOnce(mockProfile)
    await buildApp().request('/me/profile')
    expect(mockGetBuddyProfile).toHaveBeenCalledWith('user-1')
  })
})

describe('PUT /me/profile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/me/profile', { method: 'PUT' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body has wrong field types', async () => {
    const res = await buildApp().request('/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languages: 'not-an-array' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid request body')
  })

  it('returns 404 when profile does not exist', async () => {
    mockUpdateBuddyProfile.mockResolvedValueOnce(null)
    const res = await buildApp().request('/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'hello' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 200 with updated profile', async () => {
    const updated = { ...mockProfile, bio: 'hello' }
    mockUpdateBuddyProfile.mockResolvedValueOnce(updated)
    const res = await buildApp().request('/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'hello' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bio).toBe('hello')
  })

  it('passes parsed body to updateBuddyProfile', async () => {
    mockUpdateBuddyProfile.mockResolvedValueOnce(mockProfile)
    await buildApp().request('/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Name', skills: ['english'] }),
    })
    expect(mockUpdateBuddyProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ displayName: 'New Name', skills: ['english'] })
    )
  })

  it('returns 200 with empty body (no-op update)', async () => {
    mockUpdateBuddyProfile.mockResolvedValueOnce(mockProfile)
    const res = await buildApp().request('/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
  })
})
