import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import type { AuthEnv } from '../types'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { User } from '@prisma/client'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
  },
}))

import { auth } from '../lib/firebase'
import { db } from '../lib/db'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockVerify = vi.mocked(auth).verifyIdToken
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindUnique = vi.mocked(db.user).findUnique

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', authMiddleware)
  app.get('/test', (c) => c.json({ userId: c.get('user').id }))
  return app
}

const mockDecodedToken = { uid: 'uid-123', email: 'test@example.com' }
const mockDbUser = { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role: 'buddy' }

describe('authMiddleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no Authorization header', async () => {
    const res = await buildApp().request('/test')
    expect(res.status).toBe(401)
  })

  it('returns 401 when token verification fails', async () => {
    mockVerify.mockRejectedValueOnce(new Error('invalid'))

    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer bad-token' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when user is not in the database', async () => {
    mockVerify.mockResolvedValueOnce(mockDecodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(null)

    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('User not found')
  })

  it('calls next and sets user on context when token and DB user are valid', async () => {
    mockVerify.mockResolvedValueOnce(mockDecodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(mockDbUser as unknown as User)

    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string }
    expect(body.userId).toBe('user-1')
  })

  it('looks up DB user by firebaseUid from the token', async () => {
    mockVerify.mockResolvedValueOnce(mockDecodedToken as unknown as DecodedIdToken)
    mockFindUnique.mockResolvedValueOnce(mockDbUser as unknown as User)

    await buildApp().request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firebaseUid: 'uid-123' } })
    )
  })
})
