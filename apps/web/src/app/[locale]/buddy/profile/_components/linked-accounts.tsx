'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth, GOOGLE_PROVIDER_ID, APPLE_PROVIDER_ID, type LinkableProviderId } from '@/lib/auth'
import { isAppleSignInEnabled } from '@/lib/flags'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import { AppleSignInButton } from '@/components/apple-sign-in-button'

/**
 * Lets a buddy attach a second sign-in provider to the account they are
 * already signed in to (#194). Linking from an authenticated session is the
 * only mechanism that works for Apple's Hide My Email: the relay address never
 * equals the Google one, so sign-in-time matching has no shared key, whereas
 * here identity is already proven by the live session.
 *
 * Both providers are linkable, because whichever one the buddy signed up with
 * is the one the other has to be added to.
 */
export function LinkedAccounts() {
  const { linkedProviderIds, linkProvider } = useAuth()
  const t = useTranslations('profile.linkedAccounts')
  const [error, setError] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  const appleEnabled = isAppleSignInEnabled()

  async function onLink(providerId: LinkableProviderId) {
    setError(null)
    setIsLinking(true)
    try {
      await linkProvider(providerId)
    } catch (err) {
      const code = (err as { code?: string }).code
      // The buddy dismissed the popup — not a failure worth reporting.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      // Both codes mean the same thing to the buddy: that identity belongs to a
      // different Peace Buddy account and only an admin can untangle it.
      // Firebase picks between them by which uniqueness the server hit first —
      // the provider subject (credential-already-in-use) or the address
      // (email-already-in-use, when the project is one-account-per-email).
      // Named for the provider that was clicked: either direction is linkable,
      // so a fixed "Apple ID" would be wrong half the time.
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        setError(t('error.alreadyInUse', { provider: t(providerId === APPLE_PROVIDER_ID ? 'apple' : 'google') }))
      } else setError(t('error.unknown'))
    } finally {
      setIsLinking(false)
    }
  }
  const googleLinked = linkedProviderIds.includes(GOOGLE_PROVIDER_ID)
  const appleLinked = linkedProviderIds.includes(APPLE_PROVIDER_ID)

  return (
    <section className="mt-8 rounded-lg border p-4">
      <h2 className="text-base font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>

      {error && (
        <p className="mt-3 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <ul className="mt-4 space-y-3">
        <li className="flex items-center justify-between gap-4">
          <span className="text-sm">{t('google')}</span>
          {googleLinked ? (
            <span className="text-sm text-muted-foreground">{t('connected')}</span>
          ) : (
            <GoogleSignInButton
              label={t('connectGoogle')}
              onClick={() => onLink(GOOGLE_PROVIDER_ID)}
              disabled={isLinking}
            />
          )}
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="text-sm">{t('apple')}</span>
          {appleLinked ? (
            <span className="text-sm text-muted-foreground">{t('connected')}</span>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <AppleSignInButton
                label={t('connectApple')}
                onClick={() => onLink(APPLE_PROVIDER_ID)}
                disabled={!appleEnabled || isLinking}
              />
              {!appleEnabled && (
                <p className="text-xs text-muted-foreground">{t('comingSoon')}</p>
              )}
            </div>
          )}
        </li>
      </ul>
    </section>
  )
}
