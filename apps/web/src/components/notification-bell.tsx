'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { useNotifications } from '@/hooks/use-notifications'

export function NotificationBell() {
  const { locale } = useParams<{ locale: string }>()
  const { firebaseUser, dbUser } = useAuth()
  const t = useTranslations('notifications')
  const { data } = useNotifications(!!firebaseUser && !!dbUser)

  const count = data?.unreadCount ?? 0

  return (
    <Link
      href={routes.notifications(locale)}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      aria-label={t('bellLabel', { count })}
    >
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
