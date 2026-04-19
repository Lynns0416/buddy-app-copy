'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'
import { apiRequest } from '../../../lib/api'

type Tour = {
  id: string
  groupId: string
  group: { id: string; name: string; type: string }
  status: string
  tourDate: string
  meetingTime: string
  location: string
  capacity: number
  description: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
  createdAt: string
  updatedAt: string
}

export default function DashboardPage() {
  const { firebaseUser, dbUser, loading, signOut } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('dashboard')
  const [tours, setTours] = useState<Tour[]>([])

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser?.buddyProfile?.status === 'pending') {
        router.replace(routes.pending(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser?.buddyProfile?.status === 'active') {
      const from = new Date().toISOString().split('T')[0]
      apiRequest<Tour[]>(`/tours?from=${from}`)
        .then(setTours)
        .catch(() => {})
    }
  }, [loading, firebaseUser, dbUser])

  if (loading || !dbUser) return null

  if (dbUser.buddyProfile?.status !== 'active') {
    return (
      <main>
        <p>{t('notRegistered')}</p>
        <button onClick={signOut}>{t('signOut')}</button>
      </main>
    )
  }

  return (
    <main>
      <div>
        <h1>{t('title')}</h1>
        <button onClick={signOut}>{t('signOut')}</button>
      </div>
      {tours.length === 0 ? (
        <p>{t('noTours')}</p>
      ) : (
        <ul>
          {tours.map((tour) => (
            <li key={tour.id}>
              <p>{tour.group.name}</p>
              <p>{tour.tourDate}</p>
              <p>{t('meetingTime')}: {tour.meetingTime}</p>
              <p>{t('location')}: {tour.location}</p>
              <p>{t('capacity')}: {tour.capacity}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
