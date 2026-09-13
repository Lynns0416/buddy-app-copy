import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routes } from './index'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { User } from '@prisma/client'
import type { UserResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: {
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../services/auth.service', () => ({
  upsertUser: vi.fn(),
  getUser: vi.fn(),
  updateLocale: vi.fn(),
}))

import { auth } from '../lib/firebase'
import { db } from '../lib/db'
import { upsertUser, getUser, updateLocale } from '../services/auth.service'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockVerify = vi.mocked(auth).verifyIdToken
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindUnique = vi.mocked(db.user).findUnique
const mockUpsertUser = vi.mocked(upsertUser)
const mockGetUser = vi.mocked(getUser)
const mockUpdateLocale = vi.mocked(updateLocale)

const validToken = 'valid-token'
const decodedToken = { uid: 'uid-123', email: 'test@example.com', name: 'Test', picture: undefined }
const dbUser = { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role: 'buddy' }
const userResponse = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'buddy',
  createdAt: new Date('2026-01-01'),
  buddyProfile: {
    id: 'profile-1',
    status: 'pending',
    tier: null,
    displayName: 'Test',
    realName: '',
    photoUrl: null,
    bio: null,
    contactInfo: null,
    languages: [],
    skills: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
}

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/auth/register', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    mockVerify.mockRejectedValueOnce(new Error('invalid'))

    const res = await routes.request('/auth/register', {
      method: 'POST',
      headers: { Authorization: 'Bearer bad' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body has wrong field types', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)

    const res = await routes.request('/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 123 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid request body')
  })

  it('returns 400 when languages contains duplicates', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)

    const res = await routes.request('/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ languages: ['english', 'english'] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid request body')
  })

  it('returns 201 with the user on success', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockUpsertUser.mockResolvedValueOnce(userResponse as unknown as UserResponse)

    const res = await routes.request('/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as UserResponse
    expect(body.id).toBe('user-1')
    expect(body.buddyProfile?.status).toBe('pending')
  })

  it('passes firebase name to upsertUser but not the Google picture', async () => {
    mockVerify.mockResolvedValueOnce({
      uid: 'uid-123',
      email: 'test@example.com',
      name: 'Firebase Name',
      picture: 'https://photo.url',
    } as unknown as DecodedIdToken)
    mockUpsertUser.mockResolvedValueOnce(userResponse as unknown as UserResponse)

    await routes.request('/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(mockUpsertUser).toHaveBeenCalledWith(
      'uid-123',
      'test@example.com',
      expect.objectContaining({ displayName: 'Firebase Name' })
    )
    // Photos are blob names in private storage; an external URL has no place there.
    expect(mockUpsertUser.mock.calls[0][2]).not.toHaveProperty('photoUrl')
  })
})

describe('GET /auth/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 when user is not in the database', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(null)

    const res = await routes.request('/auth/me', {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when getUser returns null', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(dbUser as unknown as User)
    mockGetUser.mockResolvedValueOnce(null)

    const res = await routes.request('/auth/me', {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    expect(res.status).toBe(404)
  })

  it('returns 200 with sanitized user', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(dbUser as unknown as User)
    mockGetUser.mockResolvedValueOnce(userResponse as unknown as UserResponse)

    const res = await routes.request('/auth/me', {
      headers: { Authorization: `Bearer ${validToken}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as UserResponse & { firebaseUid?: unknown }
    expect(body.id).toBe('user-1')
    expect(body.buddyProfile?.status).toBe('pending')
    expect(body.firebaseUid).toBeUndefined()
    expect(body.buddyProfile?.tier).toBeNull()
    expect((body.buddyProfile as Record<string, unknown> | null | undefined)?.memberType).toBeUndefined()
    expect((body.buddyProfile as Record<string, unknown> | null | undefined)?.internalNotes).toBeUndefined()
  })
})

describe('PUT /auth/me/locale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/auth/me/locale', { method: 'PUT' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not JSON', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(dbUser as unknown as User)

    const res = await routes.request('/auth/me/locale', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(mockUpdateLocale).not.toHaveBeenCalled()
  })

  it('returns 400 when locale is not "ja" or "en"', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(dbUser as unknown as User)

    const res = await routes.request('/auth/me/locale', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'fr' }),
    })
    expect(res.status).toBe(400)
    expect(mockUpdateLocale).not.toHaveBeenCalled()
  })

  it('returns 404 when the user no longer exists', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(dbUser as unknown as User)
    mockUpdateLocale.mockResolvedValueOnce(null)

    const res = await routes.request('/auth/me/locale', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 200 with updated user when valid', async () => {
    mockVerify.mockResolvedValueOnce(decodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(dbUser as unknown as User)
    mockUpdateLocale.mockResolvedValueOnce({ ...userResponse, locale: 'en' } as unknown as UserResponse)

    const res = await routes.request('/auth/me/locale', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    })

    expect(res.status).toBe(200)
    expect(mockUpdateLocale).toHaveBeenCalledWith('user-1', 'en')
  })
})
