'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'
import { apiClient } from '../../../lib/api-client'
import type { TourResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'

export default function DashboardPage() {
  const { firebaseUser, dbUser, loading, signOut } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('dashboard')
  const [tours, setTours] = useState<TourResponse[]>([])

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.pending) {
        router.replace(routes.pending(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.active) {
      const from = new Date().toISOString().split('T')[0]
      apiClient.listTours(from).then(setTours).catch(() => {})
    }
  }, [loading, firebaseUser, dbUser])

  if (loading || !dbUser) return null

  if (dbUser.buddyProfile?.status !== BuddyStatusSchema.enum.active) {
    return (
      <AppShell variant="buddy">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('notRegistered')}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell variant="buddy">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {tours.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTours')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tours.map((tour) => (
            <Link key={tour.id} href={routes.dashboardTour(locale, tour.id)} className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors">
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="font-medium">{tour.group.name}</p>
                <Badge variant="secondary" className="shrink-0">
                  {tour.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {tour.tourDate.slice(0, 10)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {tour.meetingTime.slice(11, 16)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  {tour.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  {tour.capacity}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
