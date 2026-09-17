// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const intlMiddleware = vi.hoisted(() => vi.fn(() => new Response(null, { status: 200 })))
vi.mock('next-intl/middleware', () => ({ default: () => intlMiddleware }))

import middleware from './middleware'

function request(path: string, session?: string) {
  return new NextRequest(new URL(path, 'http://localhost'), {
    headers: session ? { cookie: `__session=${session}` } : {},
  })
}

describe('middleware', () => {
  it('redirects to login with no reason param when the cookie is missing', () => {
    const res = middleware(request('/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/ja/login')
  })

  it('keeps the locale from the path on redirect', () => {
    const res = middleware(request('/en/buddy'))
    expect(res.headers.get('location')).toBe('http://localhost/en/login')
  })

  it('does not redirect public paths without a cookie', () => {
    middleware(request('/ja/login'))
    expect(intlMiddleware).toHaveBeenCalled()
  })

  it('passes through when the cookie is present', () => {
    intlMiddleware.mockClear()
    const res = middleware(request('/ja/buddy', 'token'))
    expect(res.headers.get('location')).toBeNull()
    expect(intlMiddleware).toHaveBeenCalled()
  })
})
