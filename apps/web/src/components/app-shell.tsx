'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string }

type Props = {
  variant: 'admin' | 'buddy'
  children: React.ReactNode
}

export function AppShell({ variant, children }: Props) {
  const { locale } = useParams<{ locale: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, dbUser } = useAuth()
  const t = useTranslations('shell')
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    router.push(routes.login(locale))
  }

  const adminNavItems: NavItem[] = [
    { href: routes.adminBuddiesPending(locale), label: t('nav.buddiesPending') },
    { href: routes.adminBuddies(locale), label: t('nav.buddies') },
    { href: routes.adminTrainees(locale), label: t('nav.trainees') },
    { href: routes.adminGroups(locale), label: t('nav.groups') },
    { href: routes.adminTours(locale), label: t('nav.tours') },
    { href: routes.adminProfile(locale), label: t('nav.adminProfile') },
    ...(dbUser?.role === 'super_admin' ? [{ href: routes.adminProfiles(locale), label: t('nav.adminRoster') }] : []),
  ]

  const navItems: NavItem[] =
    variant === 'admin'
      ? adminNavItems
      : [
          { href: routes.buddy(locale), label: t('nav.tour') },
          { href: routes.buddyHistory(locale), label: t('nav.history') },
          { href: routes.buddyProfile(locale), label: t('nav.profile') },
        ]

  const allNavHrefs = navItems.map((item) => item.href)

  const navLinks = navItems.map((item) => {
    const isActive =
      pathname === item.href ||
      (pathname.startsWith(item.href + '/') &&
        !allNavHrefs.some(
          (other) => other !== item.href && other.startsWith(item.href + '/') && pathname.startsWith(other)
        ))
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setDrawerOpen(false)}
        className={cn(
          'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
          isActive
            ? 'bg-accent text-primary font-semibold border-l-2 border-primary rounded-l-none'
            : 'text-muted-foreground'
        )}
      >
        {item.label}
      </Link>
    )
  })

  return (
    <div className={cn('flex min-h-screen bg-background', variant === 'admin' && 'theme-admin')}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-sm font-semibold tracking-tight">{t('appName')}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">{navLinks}</nav>
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            {t('signOut')}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card transition-transform duration-200 md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold tracking-tight">{t('appName')}</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label={t('closeMenu')}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">{navLinks}</nav>
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            {t('signOut')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center border-b bg-card px-4 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label={t('openMenu')}
          >
            <Menu size={20} />
          </button>
          <span className="ml-3 text-sm font-semibold tracking-tight">{t('appName')}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
