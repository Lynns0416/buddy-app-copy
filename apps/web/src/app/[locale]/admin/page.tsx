'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AdminDashboardResponse } from '@peace-buddy/types'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { useNotifications } from '@/hooks/use-notifications'
import { AppShell } from '@/components/app-shell'
import { NotificationRow } from '@/components/notification-row'
import { routes } from '@/lib/routes'
import { fetchAdminDashboard } from './admin.dashboard'
import { WorklistItem, WorklistSection } from './_components/worklist-section'

const NOTIFICATION_FEED_SIZE = 5

// Tour dates are `@db.Date`, serialised as UTC midnight: the date part is the day.
function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export default function AdminHomePage() {
  const { ready, locale } = useAdminGuard()
  const t = useTranslations('adminDashboard')
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const { data: notifications, error: notificationsError, markRead } = useNotifications(ready)

  useEffect(() => {
    if (!ready) return
    fetchAdminDashboard().then((result) => {
      if (result.ok) setDashboard(result.data)
      else setLoadError(true)
    })
  }, [ready])

  if (!ready) return null

  const unread = (notifications?.items ?? []).filter((n) => n.readAt === null).slice(0, NOTIFICATION_FEED_SIZE)

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Link
          href={routes.adminToursCalendar(locale)}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          {t('calendarLink')}
        </Link>
      </div>

      {loadError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{t('loadError')}</p>
      )}

      {notificationsError && !notifications && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {t('notifications.loadError')}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {dashboard && (
          <>
            <WorklistSection
              title={t('pending.title')}
              count={dashboard.pendingBuddies.length}
              empty={t('pending.empty')}
              action={{ href: routes.adminBuddiesPending(locale), label: t('viewAll') }}
            >
              {dashboard.pendingBuddies.map((b) => (
                <WorklistItem
                  key={b.id}
                  href={routes.adminBuddyDetail(locale, b.id)}
                  title={b.displayName}
                  detail={t('pending.detail', { date: new Date(b.createdAt).toLocaleDateString(locale) })}
                />
              ))}
            </WorklistSection>

            <WorklistSection
              title={t('overdueMaybes.title')}
              count={dashboard.overdueMaybeTours.length}
              empty={t('overdueMaybes.empty')}
            >
              {dashboard.overdueMaybeTours.map((tour) => (
                <WorklistItem
                  key={tour.id}
                  href={routes.adminTourDetail(locale, tour.id)}
                  title={tour.group.name}
                  detail={t('overdueMaybes.detail', {
                    date: dateOnly(tour.tourDate),
                    count: tour.maybeCount,
                    deadline: dateOnly(tour.maybeDeadline),
                  })}
                />
              ))}
            </WorklistSection>

            <WorklistSection
              title={t('underfilled.title', { days: dashboard.underfilledLookaheadDays })}
              count={dashboard.underfilledTours.length}
              empty={t('underfilled.empty')}
            >
              {dashboard.underfilledTours.map((tour) => (
                <WorklistItem
                  key={tour.id}
                  href={routes.adminTourDetail(locale, tour.id)}
                  title={tour.group.name}
                  detail={t('underfilled.detail', {
                    date: dateOnly(tour.tourDate),
                    sessions: tour.sessions
                      .map((s) =>
                        t('underfilled.session', {
                          session: s.label ?? t('sessionFallback', { order: s.order }),
                          confirmed: s.confirmedCount,
                          min: s.minBuddies,
                        }),
                      )
                      .join(t('listSeparator')),
                  })}
                />
              ))}
            </WorklistSection>

            <WorklistSection
              title={t('missingEvaluations.title')}
              count={dashboard.toursMissingEvaluations.length}
              empty={t('missingEvaluations.empty')}
            >
              {dashboard.toursMissingEvaluations.map((tour) => (
                <WorklistItem
                  key={tour.id}
                  href={routes.adminTourDetail(locale, tour.id)}
                  title={tour.group.name}
                  detail={t('missingEvaluations.detail', { date: dateOnly(tour.tourDate), count: tour.missingCount })}
                />
              ))}
            </WorklistSection>
          </>
        )}

        {/* Held until the queues settle so the feed does not render first and then move. */}
        {notifications && (dashboard || loadError) && (
          <WorklistSection
            title={t('notifications.title')}
            count={notifications.unreadCount}
            empty={t('notifications.empty')}
            action={{ href: routes.notifications(locale), label: t('viewAll') }}
          >
            {unread.map((n) => (
              <NotificationRow key={n.id} item={n} onMarkRead={() => markRead({ ids: [n.id] })} />
            ))}
            {/* `unreadCount` covers every notification; the feed shows the newest
                page, capped. Say so whenever the badge outruns the rows. */}
            {unread.length < notifications.unreadCount && (
              <li className="px-4 py-3 text-sm text-muted-foreground">{t('notifications.olderUnread')}</li>
            )}
          </WorklistSection>
        )}
      </div>
    </AppShell>
  )
}
