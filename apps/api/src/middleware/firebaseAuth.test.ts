import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { firebaseAuthMiddleware } from './firebaseAuth'
import type { FirebaseEnv } from '../types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

import { auth } from '../lib/firebase'
const mockVerify = vi.mocked(auth.verifyIdToken)

function buildApp() {
  const app = new Hono<FirebaseEnv>()
  app.use('*', firebaseAuthMiddleware)
  app.get('/test', (c) => c.json({ uid: c.get('firebaseUser').uid }))
  return app
}

describe('firebaseAuthMiddleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no Authorization header', async () => {
    const res = await buildApp().request('/test')
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization is not Bearer', async () => {
    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Basic abc' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when token verification fails', async () => {
    mockVerify.mockRejectedValueOnce(new Error('invalid token'))

    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer bad-token' },
    })
    expect(res.status).toBe(401)
  })

  it('calls next and sets firebaseUser on context when token is valid', async () => {
    mockVerify.mockResolvedValueOnce({
      uid: 'uid-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: undefined,
    } as any)

    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uid).toBe('uid-123')
  })

  it('passes the token (not the Bearer prefix) to verifyIdToken', async () => {
    mockVerify.mockResolvedValueOnce({ uid: 'uid-123', email: 'a@b.com' } as any)

    await buildApp().request('/test', {
      headers: { Authorization: 'Bearer my-token' },
    })

    expect(mockVerify).toHaveBeenCalledWith('my-token')
  })
})
