'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationBell } from '@/components/notification-bell'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string }
type NavSection = { labelKey?: string; items: NavItem[] }

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

  const adminNavSections: NavSection[] = [
    { items: [{ href: routes.admin(locale), label: t('nav.home') }] },
    {
      labelKey: 'nav.sections.tours',
      items: [
        { href: routes.adminTours(locale), label: t('nav.tours') },
        { href: routes.adminGroups(locale), label: t('nav.groups') },
        { href: routes.adminPlaces(locale), label: t('nav.places') },
      ],
    },
    {
      labelKey: 'nav.sections.buddies',
      items: [
        { href: routes.adminBuddiesPending(locale), label: t('nav.buddiesPending') },
        { href: routes.adminBuddies(locale), label: t('nav.buddies') },
        { href: routes.adminTrainees(locale), label: t('nav.trainees') },
      ],
    },
  ]

  // Personal items sit in the footer with language and sign-out, apart from the work sections.
  const adminAccountItems: NavItem[] = [
    { href: routes.adminProfile(locale), label: t('nav.adminProfile') },
    { href: routes.adminNotificationPreferences(locale), label: t('nav.adminNotificationPreferences') },
    ...(dbUser?.role === 'super_admin' ? [{ href: routes.adminProfiles(locale), label: t('nav.adminRoster') }] : []),
  ]

  // Only active buddies have tours and history; anyone else (trainee, rejected,
  // suspended) would dead-end on those pages, so they see Profile only.
  const buddyNavItems: NavItem[] =
    dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.active
      ? [
          { href: routes.buddy(locale), label: t('nav.home') },
          { href: routes.buddyHistory(locale), label: t('nav.history') },
          { href: routes.buddyProfile(locale), label: t('nav.profile') },
        ]
      : [{ href: routes.buddyProfile(locale), label: t('nav.profile') }]

  const navSections: NavSection[] = variant === 'admin' ? adminNavSections : [{ items: buddyNavItems }]
  const accountItems: NavItem[] = variant === 'admin' ? adminAccountItems : []

  const allNavHrefs = [...navSections.flatMap((section) => section.items), ...accountItems].map((item) => item.href)

  function isActive(href: string) {
    return (
      pathname === href ||
      (pathname.startsWith(href + '/') &&
        !allNavHrefs.some((other) => other !== href && other.startsWith(href + '/') && pathname.startsWith(other)))
    )
  }

  function renderLink(item: NavItem) {
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setDrawerOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
          active
            ? 'bg-accent text-primary font-semibold border-l-2 border-primary rounded-l-none'
            : 'text-muted-foreground'
        )}
      >
        {item.label}
      </Link>
    )
  }

  function renderFooter() {
    return (
      <div className="border-t p-3 space-y-3">
        {accountItems.length > 0 && (
          <nav aria-label={t('nav.accountLabel')} className="flex flex-col gap-1">
            {accountItems.map(renderLink)}
          </nav>
        )}
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          {t('signOut')}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-screen bg-background', variant === 'admin' && 'theme-admin')}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold tracking-tight">{t('appName')}</span>
          <NotificationBell />
        </div>
        <NavSections idPrefix="desktop" label={t('nav.mainLabel')} sections={navSections} t={t} renderLink={renderLink} />
        {renderFooter()}
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
        <NavSections idPrefix="drawer" label={t('nav.mainLabel')} sections={navSections} t={t} renderLink={renderLink} />
        {renderFooter()}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex items-center">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              aria-label={t('openMenu')}
            >
              <Menu size={20} />
            </button>
            <span className="ml-3 text-sm font-semibold tracking-tight">{t('appName')}</span>
          </div>
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

type NavSectionsProps = {
  idPrefix: string
  label: string
  sections: NavSection[]
  t: (key: string) => string
  renderLink: (item: NavItem) => React.ReactNode
}

// Desktop sidebar and mobile drawer both render this, so heading ids need a
// per-instance prefix to stay unique on the page.
function NavSections({ idPrefix, label, sections, t, renderLink }: NavSectionsProps) {
  const baseId = useId()
  return (
    <nav aria-label={label} className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {sections.map((section, index) => {
        if (!section.labelKey) {
          return (
            <div key={index} className="flex flex-col gap-1">
              {section.items.map(renderLink)}
            </div>
          )
        }
        const headingId = `${baseId}-${idPrefix}-${index}`
        return (
          <div key={index} role="group" aria-labelledby={headingId} className="flex flex-col gap-1 border-t pt-3">
            <div id={headingId} className="px-3 pb-1 text-xs font-bold tracking-wide text-foreground">
              {t(section.labelKey)}
            </div>
            <div className="ml-3 flex flex-col gap-1 border-l pl-2">{section.items.map(renderLink)}</div>
          </div>
        )
      })}
    </nav>
  )
}
