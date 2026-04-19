import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { adminAuthMiddleware } from './adminAuth'
import type { AuthEnv } from '../types'

function buildApp(role: string) {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('user', { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role } as any)
    return next()
  })
  app.use('*', adminAuthMiddleware)
  app.get('/test', (c) => c.json({ ok: true }))
  return app
}

describe('adminAuthMiddleware', () => {
  it('returns 403 for buddy role', async () => {
    const res = await buildApp('buddy').request('/test')
    expect(res.status).toBe(403)
  })

  it('returns 403 for trainee role', async () => {
    const res = await buildApp('trainee').request('/test')
    expect(res.status).toBe(403)
  })

  it('passes through for admin role', async () => {
    const res = await buildApp('admin').request('/test')
    expect(res.status).toBe(200)
  })

  it('passes through for super_admin role', async () => {
    const res = await buildApp('super_admin').request('/test')
    expect(res.status).toBe(200)
  })
})
