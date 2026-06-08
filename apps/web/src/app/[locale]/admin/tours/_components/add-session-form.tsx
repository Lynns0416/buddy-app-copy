'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminTourDetailResponse } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addTourSession } from '../admin.tour'

interface Props {
  tourId: string
  onAdded: (tour: AdminTourDetailResponse) => void
  onCancel: () => void
}

export function AddSessionForm({ tourId, onAdded, onCancel }: Props) {
  const t = useTranslations('adminTours')
  const [meetingTime, setMeetingTime] = useState('')
  const [capacity, setCapacity] = useState('')
  const [minBuddies, setMinBuddies] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!meetingTime || !capacity) return
    const minBuddiesNum = minBuddies === '' ? null : Number(minBuddies)
    if (minBuddiesNum != null && minBuddiesNum > Number(capacity)) {
      setError(t('minBuddiesExceedsCapacity'))
      return
    }
    setSaving(true)
    setError(null)
    const result = await addTourSession(tourId, {
      meetingTime,
      capacity: Number(capacity),
      minBuddies: minBuddiesNum,
    })
    if (result.ok) {
      onAdded(result.data)
    } else if (result.error.code === 'conflict') {
      setError(t('session.error.maxSessions'))
    } else {
      setError(t('error.unknown'))
    }
    setSaving(false)
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-md border p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold">{t('session.defaultLabel.2')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="add-session-meetingTime">{t('meetingTime')}</Label>
        <Input
          id="add-session-meetingTime"
          type="time"
          value={meetingTime}
          onChange={(e) => setMeetingTime(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="add-session-capacity">{t('capacity')}</Label>
        <Input
          id="add-session-capacity"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="add-session-minBuddies">{t('minBuddies')}</Label>
        <Input
          id="add-session-minBuddies"
          type="number"
          min={0}
          value={minBuddies}
          onChange={(e) => setMinBuddies(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{t('save')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  )
}
