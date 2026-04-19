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
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  onIdTokenChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { firebaseAuth } from './firebase'
import { apiRequest } from './api'
import type { UserResponse } from '@peace-buddy/types'

// Alias for UserResponse — keeps call sites using useAuth().dbUser stable
export type DbUser = UserResponse

type AuthContextValue = {
  firebaseUser: FirebaseUser | null
  dbUser: DbUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signOut: () => Promise<void>
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
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND token refresh (every ~1 hour),
    // keeping the __session cookie fresh. onAuthStateChanged would miss token refreshes.
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user)

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
            .catch(() => setDbUser(null))
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
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(firebaseAuth, provider)
    const token = await result.user.getIdToken()
    writeTokenCookie(token)
    // Set dbUser from the register response directly to avoid a redundant /auth/me call
    // when onIdTokenChanged fires immediately after sign-in.
    const me = await apiRequest<DbUser>('/auth/register', { method: 'POST' })
    setDbUser(me)
    setFirebaseUser(result.user)
  }, [])

  const signInWithApple = useCallback(async () => {
    const provider = new OAuthProvider('apple.com')
    provider.addScope('email')
    provider.addScope('name')
    const result = await signInWithPopup(firebaseAuth, provider)
    const token = await result.user.getIdToken()
    writeTokenCookie(token)
    // Set dbUser from the register response directly to avoid a redundant /auth/me call
    // when onIdTokenChanged fires immediately after sign-in.
    const me = await apiRequest<DbUser>('/auth/register', { method: 'POST' })
    setDbUser(me)
    setFirebaseUser(result.user)
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth)
    clearTokenCookie()
    setDbUser(null)
    setFirebaseUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ firebaseUser, dbUser, loading, signInWithGoogle, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
