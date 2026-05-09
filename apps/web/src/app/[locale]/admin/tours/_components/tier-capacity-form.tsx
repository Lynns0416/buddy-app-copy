'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BookingPoolSchema, AppErrorCodeSchema } from '@peace-buddy/types'
import type { AppError, TierCapacities } from '@peace-buddy/types'
import { fetchSessionTierCapacities, saveSessionTierCapacities } from '../admin.tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const POOLS = [BookingPoolSchema.enum.junior, BookingPoolSchema.enum.non_junior, BookingPoolSchema.enum.anyone] as const

const DEFAULT_PERCENTS: Record<typeof POOLS[number], number> = {
  junior: 20,
  non_junior: 30,
  anyone: 50,
}

interface Props {
  tourId: string
  sessionId: string
  sessionOrder: number
  sessionLabel: string | null
  totalSessions: number
  capacity: number
}

export function TierCapacityForm({ tourId, sessionId, sessionOrder, sessionLabel, totalSessions, capacity }: Props) {
  const t = useTranslations('adminTours')
  const [percents, setPercents] = useState<TierCapacities>(DEFAULT_PERCENTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function errorMessage(e: AppError): string {
    switch (e.code) {
      case AppErrorCodeSchema.enum.network: return t('error.network')
      default:                              return t('error.unknown')
    }
  }

  useEffect(() => {
    fetchSessionTierCapacities(tourId, sessionId).then((result) => {
      if (!result.ok) return
      setPercents(result.data)
    })
  }, [tourId, sessionId])

  const total = POOLS.reduce((s, p) => s + percents[p], 0)
  const sumError = total !== 100

  function handleChange(pool: typeof POOLS[number], value: string) {
    const n = parseInt(value, 10)
    setPercents((prev) => ({ ...prev, [pool]: isNaN(n) ? 0 : n }))
    setSaved(false)
    setError(null)
  }

  async function handleSave() {
    if (sumError) return
    setSaving(true)
    setError(null)
    const result = await saveSessionTierCapacities(tourId, sessionId, percents)
    if (result.ok) {
      setPercents(result.data)
      setSaved(true)
    } else {
      setError(errorMessage(result.error))
    }
    setSaving(false)
  }

  const sessionTitle = sessionLabel ?? (totalSessions > 1 ? t(`session.defaultLabel.${sessionOrder}`) : null)

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold">
        {t('tierCapacity.title')}{sessionTitle ? ` — ${sessionTitle}` : ''}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {POOLS.map((pool) => (
          <div key={pool}>
            <label className="mb-1 block text-sm text-muted-foreground">
              {t(`tierCapacity.${pool}`)}
            </label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={percents[pool]}
                onChange={(e) => handleChange(pool, e.target.value)}
                className="w-20 tabular-nums"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="ml-2 text-sm font-medium tabular-nums">
                = {Math.floor(capacity * percents[pool] / 100)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className={`text-sm ${sumError ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {t('tierCapacity.total', { total })}
          {sumError && ` — ${t('tierCapacity.sumError')}`}
        </span>
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={saving || sumError} onClick={() => void handleSave()}>
          {t('save')}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">{t('tierCapacity.saved')}</span>}
      </div>
    </div>
  )
}
