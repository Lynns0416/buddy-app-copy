'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  signInWithPopup,
  linkWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  onIdTokenChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { firebaseAuth } from './firebase'
import { apiRequest, ApiError } from './api'
import type { BuddyProfileResponse, UserResponse } from '@peace-buddy/types'

// Alias for UserResponse — keeps call sites using useAuth().dbUser stable
export type DbUser = UserResponse

// Firebase provider ids. Client-side identity only — never an API contract, so
// these stay here rather than in packages/types.
export const GOOGLE_PROVIDER_ID = 'google.com'
export const APPLE_PROVIDER_ID = 'apple.com'
export type LinkableProviderId = typeof GOOGLE_PROVIDER_ID | typeof APPLE_PROVIDER_ID

function buildProvider(providerId: LinkableProviderId) {
  if (providerId === GOOGLE_PROVIDER_ID) return new GoogleAuthProvider()
  const apple = new OAuthProvider(APPLE_PROVIDER_ID)
  apple.addScope('email')
  apple.addScope('name')
  return apple
}

type AuthContextValue = {
  firebaseUser: FirebaseUser | null
  dbUser: DbUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  // Provider ids already attached to the signed-in Firebase user
  // ('google.com', 'apple.com'). Held as state rather than read off
  // firebaseUser.providerData: linking mutates the same User object, so a
  // re-render needs a new value, not the same reference back.
  linkedProviderIds: string[]
  linkProvider: (providerId: LinkableProviderId) => Promise<void>
  signOut: () => Promise<void>
  setBuddyProfile: (profile: BuddyProfileResponse) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function writeTokenCookie(token: string) {
  document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`
}

function clearTokenCookie() {
  document.cookie = '__session=; path=/; max-age=0'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [linkedProviderIds, setLinkedProviderIds] = useState<string[]>([])
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND token refresh (every ~1 hour),
    // keeping the __session cookie fresh. onAuthStateChanged would miss token refreshes.
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user)
      setLinkedProviderIds(user ? user.providerData.map((p) => p.providerId) : [])

      if (user) {
        const token = await user.getIdToken()
        writeTokenCookie(token)

        // Only fetch /auth/me if dbUser is not already populated.
        // When the user just signed in via signInWithGoogle/Apple, dbUser is set
        // directly from the /auth/register response, so we skip the extra call.
        // This handler will still call /auth/me on token refresh (when dbUser is null
        // after a page reload) to rehydrate the user.
        setDbUser((current) => {
          if (current !== null) {
            // dbUser already set — token refresh, no need to re-fetch
            return current
          }
          // Fetch asynchronously and update state once resolved
          apiRequest<DbUser>('/auth/me')
            .then((me) => setDbUser(me))
            .catch((err) => {
              if (err instanceof ApiError && err.status === 401) {
                if (window.location.pathname.includes('/login')) {
                  setDbUser(null)
                  return
                }
                firebaseSignOut(firebaseAuth).catch(() => {})
                clearTokenCookie()
                const localeMatch = window.location.pathname.match(/^\/(ja|en)/)
                const locale = localeMatch ? localeMatch[1] : 'ja'
                window.location.replace(`/${locale}/login?reason=session_expired`)
                return
              }
              setDbUser(null)
            })
          return null
        })
      } else {
        clearTokenCookie()
        setDbUser(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(firebaseAuth, buildProvider(GOOGLE_PROVIDER_ID))
    const token = await result.user.getIdToken()
    writeTokenCookie(token)
    // Set dbUser from the register response directly to avoid a redundant /auth/me call
    // when onIdTokenChanged fires immediately after sign-in.
    const me = await apiRequest<DbUser>('/auth/register', { method: 'POST' })
    setDbUser(me)
    setFirebaseUser(result.user)
  }, [])

  const signInWithApple = useCallback(async () => {
    const result = await signInWithPopup(firebaseAuth, buildProvider(APPLE_PROVIDER_ID))
    const token = await result.user.getIdToken()
    writeTokenCookie(token)
    // Set dbUser from the register response directly to avoid a redundant /auth/me call
    // when onIdTokenChanged fires immediately after sign-in.
    const me = await apiRequest<DbUser>('/auth/register', { method: 'POST' })
    setDbUser(me)
    setFirebaseUser(result.user)
  }, [])

  // Attaches a second provider to the Firebase user that is already signed in.
  // Firebase keeps the same uid, so `User.firebaseUid` still resolves to the
  // same row — no second User, no duplicate BuddyProfile (#194). Either
  // direction works, because whichever provider the buddy started with is the
  // one the other has to be added to. This is also the only path that covers
  // Apple's Hide My Email, where the relay address never matches the Google one
  // and so nothing can be matched on at sign-in time.
  const linkProvider = useCallback(async (providerId: LinkableProviderId) => {
    const current = firebaseAuth.currentUser
    if (!current) throw new Error('linkProvider called with no signed-in user')
    const result = await linkWithPopup(current, buildProvider(providerId))
    setLinkedProviderIds(result.user.providerData.map((p) => p.providerId))
  }, [])

  // Lets a page that changed the buddy profile through the API keep dbUser in
  // step without a second /auth/me round trip.
  const setBuddyProfile = useCallback((profile: BuddyProfileResponse) => {
    setDbUser((current) => (current ? { ...current, buddyProfile: profile } : current))
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth)
    clearTokenCookie()
    setDbUser(null)
    setFirebaseUser(null)
    setLinkedProviderIds([])
  }, [])

  return (
    <AuthContext.Provider value={{ firebaseUser, dbUser, loading, signInWithGoogle, signInWithApple, linkedProviderIds, linkProvider, signOut, setBuddyProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
