'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api'
import type { AdminTourDetailResponse, GroupResponse } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type TourFormValues = {
  groupId: string
  tourDate: string
  meetingTime: string
  location: string
  capacity: number
  description: string | null
  adminMemo: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
}

type Props = {
  defaultValues?: AdminTourDetailResponse
  groups: GroupResponse[]
  cancelHref: string
  onSubmit: (values: TourFormValues) => Promise<void>
}

export function TourForm({ defaultValues, groups, cancelHref, onSubmit }: Props) {
  const t = useTranslations('adminTours')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const cancellationDeadline = form.get('cancellationDeadline') as string
    const maybeDeadline = (form.get('maybeDeadline') as string) || null

    if (maybeDeadline && maybeDeadline >= cancellationDeadline) {
      setFieldErrors({ maybeDeadline: [t('maybeDeadlineError')] })
      setError(t('validationError'))
      return
    }

    const values: TourFormValues = {
      groupId: form.get('groupId') as string,
      tourDate: form.get('tourDate') as string,
      meetingTime: form.get('meetingTime') as string,
      location: form.get('location') as string,
      capacity: Number(form.get('capacity')),
      description: (form.get('description') as string) || null,
      adminMemo: (form.get('adminMemo') as string) || null,
      cancellationDeadline,
      maybeDeadline,
      notificationOffsets: (form.get('notificationOffsets') as string)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n)),
    }

    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      await onSubmit(values)
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setFieldErrors(err.details.fieldErrors)
        setError(
          err.details.formErrors.length > 0
            ? err.details.formErrors.join(' / ')
            : t('validationError'),
        )
      } else {
        setError(err instanceof Error ? err.message : t('actionError'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="groupId">{t('group')}</Label>
            <select
              id="groupId"
              name="groupId"
              required
              defaultValue={defaultValues?.group.id}
              className="border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tourDate">{t('tourDate')}</Label>
            <Input id="tourDate" name="tourDate" type="date" required defaultValue={defaultValues?.tourDate.slice(0, 10)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meetingTime">{t('meetingTime')}</Label>
            <Input id="meetingTime" name="meetingTime" type="time" required defaultValue={defaultValues?.meetingTime.slice(11, 16)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">{t('location')}</Label>
            <Input id="location" name="location" required defaultValue={defaultValues?.location} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capacity">{t('capacity')}</Label>
            <Input id="capacity" name="capacity" type="number" min={1} required defaultValue={defaultValues?.capacity} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cancellationDeadline">{t('cancellationDeadline')}</Label>
            <Input id="cancellationDeadline" name="cancellationDeadline" type="date" required defaultValue={defaultValues?.cancellationDeadline.slice(0, 10)} />
            {fieldErrors.cancellationDeadline?.map((e) => (
              <p key={e} className="text-xs text-destructive">{e}</p>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maybeDeadline">{t('maybeDeadline')}</Label>
            <Input id="maybeDeadline" name="maybeDeadline" type="date" defaultValue={defaultValues?.maybeDeadline?.slice(0, 10) ?? ''} />
            {fieldErrors.maybeDeadline?.map((e) => (
              <p key={e} className="text-xs text-destructive">{e}</p>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notificationOffsets">{t('notificationOffsets')}</Label>
            <Input
              id="notificationOffsets"
              name="notificationOffsets"
              defaultValue={defaultValues ? defaultValues.notificationOffsets.join(', ') : '3, 1'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={defaultValues?.description ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminMemo">{t('adminMemo')}</Label>
            <Textarea id="adminMemo" name="adminMemo" rows={3} defaultValue={defaultValues?.adminMemo ?? ''} />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" disabled={submitting}>{t('save')}</Button>
          <Button asChild variant="ghost">
            <Link href={cancelHref}>{t('cancel')}</Link>
          </Button>
        </div>
      </form>
    </>
  )
}
