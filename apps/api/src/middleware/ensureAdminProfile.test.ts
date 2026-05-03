import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { ensureAdminProfile } from './ensureAdminProfile'
import type { AuthEnv } from '../types'

const { mockUpsert } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    adminProfile: { upsert: mockUpsert },
  },
}))

function buildApp(user: AuthEnv['Variables']['user'], firebaseName?: string) {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('user', user)
    c.set('firebaseUser', { uid: user.firebaseUid, email: user.email, name: firebaseName })
    return next()
  })
  app.use('*', ensureAdminProfile)
  app.get('/', (c) => c.json({ ok: true }))
  return app
}

const adminUser: AuthEnv['Variables']['user'] = {
  id: 'user-1',
  firebaseUid: 'uid-1',
  email: 'admin@example.com',
  role: 'admin',
}

describe('ensureAdminProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts profile using Firebase display name when available', async () => {
    mockUpsert.mockResolvedValueOnce({ id: 'profile-1' } as never)
    const app = buildApp(adminUser, 'John Admin')
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {},
      create: { userId: 'user-1', name: 'John Admin' },
      select: { id: true },
    })
  })

  it('falls back to email prefix when Firebase name is absent', async () => {
    mockUpsert.mockResolvedValueOnce({ id: 'profile-1' } as never)
    const app = buildApp(adminUser)
    await app.request('/')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: 'user-1', name: 'admin' } }),
    )
  })

  it('upsert update is empty to preserve existing name', async () => {
    mockUpsert.mockResolvedValueOnce({ id: 'profile-1' } as never)
    const app = buildApp(adminUser, 'John Admin')
    await app.request('/')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    )
  })

  it('continues request when upsert throws', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('DB connection failed'))
    const app = buildApp(adminUser, 'John Admin')
    const res = await app.request('/')
    expect(res.status).toBe(200)
  })
})
