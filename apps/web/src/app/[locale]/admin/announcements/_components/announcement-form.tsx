'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import type { AdminAnnouncementResponse, AdminBuddyResponse, AdminTourSummaryResponse } from '@peace-buddy/types'
import { AnnouncementAudienceSchema, AnnouncementBuddyStatusSchema, BuddyTierSchema, TourStatusSchema, getTodayJst } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MarkdownEditor } from '@/components/markdown-editor'
import { SuggestInput } from '@/components/suggest-input'
import { apiClient } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'
import { getBuddyStatusLabel, getBuddyTierLabel } from '@/lib/status-display'
import {
  type AnnouncementFormValues,
  audienceInput,
  buddyPickLabel,
  countAnnouncementAudience,
  pickableBuddies,
  ruleExcludesTrainees,
  validateAnnouncementForm,
} from '../admin.announcement'

const COUNT_DELAY_MS = 300

type Props = {
  initial: AnnouncementFormValues
  // The saved tour, kept as an option even once it is past.
  savedTour?: AdminAnnouncementResponse['tour']
  submitLabel: string
  submitting: boolean
  onSubmit: (values: AnnouncementFormValues) => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function AnnouncementForm({ initial, savedTour, submitLabel, submitting, onSubmit }: Props) {
  const t = useTranslations('adminAnnouncements.form')
  const tStatus = useTranslations('buddyStatus')
  const tTier = useTranslations('buddyTier')
  const [values, setValues] = useState(initial)
  const [buddies, setBuddies] = useState<AdminBuddyResponse[]>([])
  const [tours, setTours] = useState<AdminTourSummaryResponse[]>([])
  const [pick, setPick] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const set = <K extends keyof AnnouncementFormValues>(key: K, value: AnnouncementFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  useEffect(() => {
    apiClient.listBuddies().then((list) => setBuddies(pickableBuddies(list))).catch(() => {
      // The picker stays empty; buddies already picked still show by id below.
    })
    const today = getTodayJst()
    apiClient
      .listAdminTours(TourStatusSchema.enum.published)
      .then((list) => setTours(list.filter((tour) => tour.tourDate.slice(0, 10) >= today)))
      .catch(() => {
        // Without the list only the saved tour, if any, can be kept.
      })
  }, [])

  // "Shows to N buddies now", recounted shortly after the audience changes.
  const { audience, statuses, tiers, buddyIds } = values
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void countAnnouncementAudience(audienceInput({ audience, statuses, tiers, buddyIds })).then((result) => {
        if (!cancelled) setCount(result.ok ? result.data.count : null)
      })
    }, COUNT_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [audience, statuses, tiers, buddyIds])

  const errors = validateAnnouncementForm(values)
  const byId = new Map(buddies.map((b) => [b.id, b]))
  const unpicked = buddies.filter((b) => !values.buddyIds.includes(b.id))

  function handlePick(text: string) {
    const match = unpicked.find((b) => buddyPickLabel(b) === text)
    if (match) {
      set('buddyIds', [...values.buddyIds, match.id])
      setPick('')
    } else {
      setPick(text)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (errors.length > 0) {
      setShowErrors(true)
      return
    }
    onSubmit(values)
  }

  const tourOptions = [
    ...(savedTour && !tours.some((tour) => tour.id === savedTour.id)
      ? [{ id: savedTour.id, label: `${formatDate(savedTour.tourDate)} ${savedTour.groupName}` }]
      : []),
    ...tours.map((tour) => ({ id: tour.id, label: `${formatDate(tour.tourDate)} ${tour.group.name}` })),
  ]

  const isRule = values.audience === AnnouncementAudienceSchema.enum.rule

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-card p-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-semibold">{t('ja')}</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titleJa">{t('title')}</Label>
          <Input id="titleJa" value={values.titleJa} onChange={(e) => set('titleJa', e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bodyJa">{t('body')}</Label>
          <MarkdownEditor id="bodyJa" rows={6} value={values.bodyJa} onChange={(e) => set('bodyJa', e.target.value)} required />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold">{t('en')}</legend>
        <p className="text-xs text-muted-foreground">{t('enHint')}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titleEn">{t('title')}</Label>
          <Input id="titleEn" value={values.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bodyEn">{t('body')}</Label>
          <MarkdownEditor id="bodyEn" rows={6} value={values.bodyEn} onChange={(e) => set('bodyEn', e.target.value)} />
        </div>
        {showErrors && errors.includes('enPair') && <p className="text-xs text-destructive">{t('error.enPair')}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">{t('audience')}</legend>
        <div className="flex flex-wrap gap-4">
          {AnnouncementAudienceSchema.options.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="audience"
                checked={values.audience === option}
                onChange={() => set('audience', option)}
              />
              {t(`audienceOption.${option}`)}
            </label>
          ))}
        </div>

        {isRule ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('statuses')}</p>
              <div className="flex flex-wrap gap-4">
                {AnnouncementBuddyStatusSchema.options.map((status) => (
                  <label key={status} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={values.statuses.includes(status)}
                      onChange={() => set('statuses', toggle(values.statuses, status))}
                    />
                    {getBuddyStatusLabel(tStatus, status)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('tiers')}</p>
              <div className="flex flex-wrap gap-4">
                {BuddyTierSchema.options.map((tier) => (
                  <label key={tier} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={values.tiers.includes(tier)}
                      onChange={() => set('tiers', toggle(values.tiers, tier))}
                    />
                    {getBuddyTierLabel(tTier, tier)}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('ruleHint')}</p>
            {ruleExcludesTrainees(values) && <p className="text-xs text-amber-700">{t('tiersExcludeTrainees')}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <SuggestInput
              id="buddyPick"
              aria-label={t('pickBuddy')}
              placeholder={t('pickBuddy')}
              value={pick}
              onChange={handlePick}
              suggestions={unpicked.map(buddyPickLabel)}
            />
            {values.buddyIds.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {values.buddyIds.map((id) => {
                  const buddy = byId.get(id)
                  const name = buddy ? buddyPickLabel(buddy) : t('unknownBuddy')
                  return (
                    <li key={id} className="flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-sm">
                      {name}
                      <button
                        type="button"
                        aria-label={t('removeBuddy', { name })}
                        onClick={() => set('buddyIds', values.buddyIds.filter((b) => b !== id))}
                        className="rounded-full p-0.5 hover:bg-accent"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {showErrors && errors.includes('noBuddies') && <p className="text-xs text-destructive">{t('error.noBuddies')}</p>}
          </div>
        )}

        <p className="text-sm font-medium" aria-live="polite">
          {count === null ? ' ' : t('count', { count })}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">{t('period')}</legend>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">{t('startDate')}</Label>
            <Input id="startDate" type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">{t('endDate')}</Label>
            <Input id="endDate" type="date" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} required />
          </div>
        </div>
        {showErrors && errors.includes('endBeforeStart') && <p className="text-xs text-destructive">{t('error.endBeforeStart')}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <Label htmlFor="tourId">{t('tour')}</Label>
        <select
          id="tourId"
          value={values.tourId}
          onChange={(e) => set('tourId', e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t('noTour')}</option>
          {tourOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t('tourHint')}</p>
      </fieldset>

      <div>
        <Button type="submit" disabled={submitting}>{submitLabel}</Button>
      </div>
    </form>
  )
}
