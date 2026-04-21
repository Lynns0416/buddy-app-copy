import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

vi.mock('./firebase', () => ({ firebaseAuth: {} }))

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { apiRequest: vi.fn(), ApiError: actual.ApiError }
})

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn().mockImplementation(() => ({ addScope: vi.fn() })),
}))

import { onIdTokenChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { apiRequest, ApiError } from './api'
import { AuthProvider } from './auth'

const mockOnIdTokenChanged = vi.mocked(onIdTokenChanged)
const mockApiRequest = vi.mocked(apiRequest)
const mockFirebaseSignOut = vi.mocked(firebaseSignOut)

type IdTokenCallback = (user: unknown) => Promise<void>

describe('AuthProvider — 401 /auth/me handling', () => {
  let capturedCallback: IdTokenCallback

  beforeEach(() => {
    vi.clearAllMocks()
    mockFirebaseSignOut.mockResolvedValue(undefined as never)
    mockOnIdTokenChanged.mockImplementation((_auth, cb) => {
      capturedCallback = cb as IdTokenCallback
      return () => {}
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubLocation(pathname: string) {
    const mockReplace = vi.fn()
    vi.stubGlobal('location', { pathname, replace: mockReplace })
    return mockReplace
  }

  async function signInWithStaleCookie() {
    render(<AuthProvider>{null}</AuthProvider>)
    await act(async () => {
      await capturedCallback({ getIdToken: async () => 'stale-token' })
    })
  }

  it('redirects to /ja/login with session_expired on 401', async () => {
    const replace = stubLocation('/ja/dashboard')
    mockApiRequest.mockRejectedValue(new ApiError('Unauthorized', 401))
    await signInWithStaleCookie()
    expect(replace).toHaveBeenCalledWith('/ja/login?reason=session_expired')
    expect(mockFirebaseSignOut).toHaveBeenCalled()
  })

  it('preserves en locale in redirect URL', async () => {
    const replace = stubLocation('/en/dashboard')
    mockApiRequest.mockRejectedValue(new ApiError('Unauthorized', 401))
    await signInWithStaleCookie()
    expect(replace).toHaveBeenCalledWith('/en/login?reason=session_expired')
  })

  it('falls back to ja when path has no locale prefix', async () => {
    const replace = stubLocation('/dashboard')
    mockApiRequest.mockRejectedValue(new ApiError('Unauthorized', 401))
    await signInWithStaleCookie()
    expect(replace).toHaveBeenCalledWith('/ja/login?reason=session_expired')
  })

  it('does not redirect when already on the login page', async () => {
    const replace = stubLocation('/ja/login')
    mockApiRequest.mockRejectedValue(new ApiError('Unauthorized', 401))
    await signInWithStaleCookie()
    expect(replace).not.toHaveBeenCalled()
    expect(mockFirebaseSignOut).not.toHaveBeenCalled()
  })

  it('does not redirect for non-401 API errors', async () => {
    const replace = stubLocation('/ja/dashboard')
    mockApiRequest.mockRejectedValue(new ApiError('Server error', 500))
    await signInWithStaleCookie()
    expect(replace).not.toHaveBeenCalled()
  })
})
