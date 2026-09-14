import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

vi.mock('./firebase', () => ({ firebaseAuth: {} }))

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { apiRequest: vi.fn(), ApiError: actual.ApiError }
})

// Hoisted above the vi.mock factory below, which is itself hoisted above imports.
const { appleAddScope } = vi.hoisted(() => ({ appleAddScope: vi.fn() }))

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  linkWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn().mockImplementation(() => ({ addScope: appleAddScope })),
}))

import {
  onIdTokenChanged,
  signOut as firebaseSignOut,
  linkWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth'
import { apiRequest, ApiError } from './api'
import { firebaseAuth } from './firebase'
import { AuthProvider, useAuth, GOOGLE_PROVIDER_ID, APPLE_PROVIDER_ID } from './auth'

const mockOnIdTokenChanged = vi.mocked(onIdTokenChanged)
const mockApiRequest = vi.mocked(apiRequest)
const mockFirebaseSignOut = vi.mocked(firebaseSignOut)
const mockLinkWithPopup = vi.mocked(linkWithPopup)
const mockGoogleAuthProvider = vi.mocked(GoogleAuthProvider)
const mockOAuthProvider = vi.mocked(OAuthProvider)
const mutableAuth = firebaseAuth as { currentUser?: unknown }

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
      await capturedCallback({ getIdToken: async () => 'stale-token', providerData: [] })
    })
  }

  it('redirects to /ja/login with session_expired on 401', async () => {
    const replace = stubLocation('/ja/buddy')
    mockApiRequest.mockRejectedValue(new ApiError('Unauthorized', 401))
    await signInWithStaleCookie()
    expect(replace).toHaveBeenCalledWith('/ja/login?reason=session_expired')
    expect(mockFirebaseSignOut).toHaveBeenCalled()
  })

  it('preserves en locale in redirect URL', async () => {
    const replace = stubLocation('/en/buddy')
    mockApiRequest.mockRejectedValue(new ApiError('Unauthorized', 401))
    await signInWithStaleCookie()
    expect(replace).toHaveBeenCalledWith('/en/login?reason=session_expired')
  })

  it('falls back to ja when path has no locale prefix', async () => {
    const replace = stubLocation('/buddy')
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
    const replace = stubLocation('/ja/buddy')
    mockApiRequest.mockRejectedValue(new ApiError('Server error', 500))
    await signInWithStaleCookie()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('AuthProvider — linking a second provider', () => {
  let capturedCallback: IdTokenCallback
  let link: (providerId: typeof GOOGLE_PROVIDER_ID | typeof APPLE_PROVIDER_ID) => Promise<void>
  let rendered: string[]

  // Reads the two pieces of context this block exercises back out of the provider.
  function Probe() {
    const { linkProvider, linkedProviderIds } = useAuth()
    link = linkProvider
    rendered = linkedProviderIds
    return null
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mutableAuth.currentUser = { uid: 'uid-1' }
    mockOnIdTokenChanged.mockImplementation((_auth, cb) => {
      capturedCallback = cb as IdTokenCallback
      return () => {}
    })
    mockApiRequest.mockResolvedValue({} as never)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
  })

  afterEach(() => {
    delete mutableAuth.currentUser
  })

  it('attaches Apple to the user already signed in, keeping the same uid', async () => {
    mockLinkWithPopup.mockResolvedValue({
      user: { uid: 'uid-1', providerData: [{ providerId: 'google.com' }, { providerId: 'apple.com' }] },
    } as never)

    await act(async () => {
      await link(APPLE_PROVIDER_ID)
    })

    expect(mockOAuthProvider).toHaveBeenCalledWith(APPLE_PROVIDER_ID)
    expect(appleAddScope).toHaveBeenCalledWith('email')
    expect(appleAddScope).toHaveBeenCalledWith('name')
    expect(mockLinkWithPopup).toHaveBeenCalledWith({ uid: 'uid-1' }, expect.anything())
  })

  it('attaches Google when that is the provider asked for', async () => {
    mockLinkWithPopup.mockResolvedValue({
      user: { uid: 'uid-1', providerData: [{ providerId: 'apple.com' }, { providerId: 'google.com' }] },
    } as never)

    await act(async () => {
      await link(GOOGLE_PROVIDER_ID)
    })

    expect(mockGoogleAuthProvider).toHaveBeenCalled()
    expect(mockOAuthProvider).not.toHaveBeenCalled()
  })

  it('exposes both providers once the link succeeds', async () => {
    mockLinkWithPopup.mockResolvedValue({
      user: { uid: 'uid-1', providerData: [{ providerId: 'google.com' }, { providerId: 'apple.com' }] },
    } as never)

    await act(async () => {
      await link(APPLE_PROVIDER_ID)
    })

    expect(rendered).toEqual(['google.com', 'apple.com'])
  })

  it('leaves the linked providers untouched when the popup fails', async () => {
    await act(async () => {
      await capturedCallback({
        getIdToken: async () => 'token',
        providerData: [{ providerId: 'google.com' }],
      })
    })
    mockLinkWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' })

    await act(async () => {
      await expect(link(APPLE_PROVIDER_ID)).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' })
    })

    expect(rendered).toEqual(['google.com'])
  })

  it('refuses to link when nobody is signed in', async () => {
    delete mutableAuth.currentUser

    await expect(link(APPLE_PROVIDER_ID)).rejects.toThrow(/no signed-in user/)
    expect(mockLinkWithPopup).not.toHaveBeenCalled()
  })

  it('tracks the providers Firebase reports on sign-in', async () => {
    await act(async () => {
      await capturedCallback({
        getIdToken: async () => 'token',
        providerData: [{ providerId: 'google.com' }, { providerId: 'apple.com' }],
      })
    })

    expect(rendered).toEqual(['google.com', 'apple.com'])
  })
})
