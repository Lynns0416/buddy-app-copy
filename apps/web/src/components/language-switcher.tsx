'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiRequest } from '@/lib/api'
import { apiPaths } from '@/lib/api-paths'
import type { Locale, UserResponse } from '@peace-buddy/types'

const LOCALES: Locale[] = ['ja', 'en']

export function LanguageSwitcher() {
  const { locale } = useParams<{ locale: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('shell.language')

  async function onChange(next: Locale) {
    if (next === locale) return
    // Best-effort: persist server-side for notifications. If user isn't signed in
    // (e.g. login page), the call 401s and we still flip the URL.
    apiRequest<UserResponse>(apiPaths.authMeLocale, {
      method: 'PUT',
      body: JSON.stringify({ locale: next }),
    }).catch(() => {})

    const rest = pathname.replace(/^\/(ja|en)/, '')
    router.push(`/${next}${rest}`)
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{t('label')}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value as Locale)}
        className="rounded-md border bg-background px-2 py-1 text-xs"
        aria-label={t('label')}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  )
}
