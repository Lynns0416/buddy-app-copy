'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ApplicationResponse } from '@peace-buddy/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getApplicationStatus, createApplication, cancelApplication } from '../tour-application'
import { CancelApplicationModal } from './cancel-application-modal'

interface TourApplicationSectionProps {
  tourId: string
  onBooked?: () => void
}

export function TourApplicationSection({ tourId, onBooked }: TourApplicationSectionProps) {
  const t = useTranslations('tourApplication')
  const [application, setApplication] = useState<ApplicationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    const fetchStatus = async () => {
      const result = await getApplicationStatus(tourId)
      if (isMounted) {
        if (result.ok) {
          setApplication(result.data)
        }
        setLoading(false)
      }
    }

    void fetchStatus()

    return () => {
      isMounted = false
    }
  }, [tourId])

  async function handleApply() {
    setActing(true)
    setError(null)
    const result = await createApplication(tourId)
    setActing(false)
    if (result.ok) {
      setApplication(result.data)
      if (result.data.status === 'approved') {
        onBooked?.()
      }
    } else {
      const errorMessages: Record<string, string> = {
        conflict: t('error.alreadyApplied'),
        not_found: t('error.tourNotFound'),
        network: t('error.network'),
      }
      setError(errorMessages[result.error.code] ?? t('error.unknown'))
    }
  }

  async function handleCancelConfirm() {
    if (!application) return
    setActing(true)
    const result = await cancelApplication(application.id)
    setActing(false)
    setCancelOpen(false)
    if (result.ok) {
      setApplication(null)
    } else {
      setError(t('error.unknown'))
    }
  }

  if (loading) return null

  // approved = booking confirmed, handled by parent booking section
  if (application?.status === 'approved') return null

  return (
    <>
      <div className="space-y-3">
        {application?.status === 'waitlisted' && (
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{t('status.waitlisted')}</Badge>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={acting}
              onClick={() => setCancelOpen(true)}
            >
              {t('actions.cancel')}
            </Button>
          </div>
        )}

        {application?.status === 'pending' && (
          <Badge variant="secondary">{t('status.pending')}</Badge>
        )}

        {application?.status === 'rejected' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('messages.rejected')}</p>
            <Button disabled={acting} onClick={() => void handleApply()}>
              {t('actions.apply')}
            </Button>
          </div>
        )}

        {application === null && (
          <Button disabled={acting} onClick={() => void handleApply()}>
            {t('actions.apply')}
          </Button>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <CancelApplicationModal
        open={cancelOpen}
        loading={acting}
        onConfirm={() => void handleCancelConfirm()}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  )
}
