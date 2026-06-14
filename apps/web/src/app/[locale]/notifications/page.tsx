'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationRow } from '@/components/notification-row'
import { UserRoleSchema } from '@peace-buddy/types'

export default function NotificationsPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('notifications')
  const ready = !!firebaseUser && !!dbUser
  const { data, markRead } = useNotifications(ready)

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace(routes.login(locale))
  }, [loading, firebaseUser, locale, router])

  if (!ready) return null

  const variant: 'admin' | 'buddy' = dbUser.role === UserRoleSchema.enum.buddy ? 'buddy' : 'admin'
  const items = data?.items ?? []
  const hasUnread = (data?.unreadCount ?? 0) > 0

  return (
    <AppShell variant={variant}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        {hasUnread && (
          <Button variant="outline" size="sm" onClick={() => markRead({ all: true })}>
            {t('markAllRead')}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((n) => (
            <NotificationRow key={n.id} item={n} onMarkRead={() => markRead({ ids: [n.id] })} />
          ))}
        </ul>
      )}
    </AppShell>
  )
}
