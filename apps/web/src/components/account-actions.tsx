'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/language-switcher'

// Language and sign-out: the sidebar footer, the admin drawer, and on mobile
// the buddy Profile page, since buddies have a bottom nav and no drawer.
export function AccountActions() {
  const { locale } = useParams<{ locale: string }>()
  const router = useRouter()
  const { signOut } = useAuth()
  const t = useTranslations('shell')

  async function handleSignOut() {
    await signOut()
    router.push(routes.login(locale))
  }

  return (
    <>
      <LanguageSwitcher />
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={handleSignOut}
      >
        {t('signOut')}
      </Button>
    </>
  )
}
