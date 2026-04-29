'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import type { AdminBuddyResponse, BuddyTier, UpdateAdminBuddyProfile } from '@peace-buddy/types'
import { BuddyTierSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { routes } from '@/lib/routes'
import { updateBuddy } from '../admin.buddy'

interface BuddyFormProps {
  buddy: AdminBuddyResponse
}

export function BuddyForm({ buddy }: BuddyFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('adminBuddies')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTier, setSelectedTier] = useState<BuddyTier | ''>((buddy.tier as BuddyTier) || '')
  const [notes, setNotes] = useState(buddy.internalNotes || '')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const data: UpdateAdminBuddyProfile = {}
    if (selectedTier !== buddy.tier) {
      data.tier = selectedTier || null
    }
    if (notes !== buddy.internalNotes) {
      data.internalNotes = notes || null
    }

    const result = await updateBuddy(buddy.id, data)
    setIsSubmitting(false)

    if (result.ok) {
      router.push(routes.adminBuddies(locale))
    } else {
      setError(t('error.unknown'))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <Label htmlFor="tier">{t('tier')}</Label>
        <Select value={selectedTier} onValueChange={(val) => setSelectedTier(val as BuddyTier | '')}>
          <SelectTrigger id="tier">
            <SelectValue placeholder={t('tierPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('tierNone')}</SelectItem>
            {BuddyTierSchema.options.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {t(`tier${tier.charAt(0).toUpperCase() + tier.slice(1)}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">{t('internalNotes')}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('internalNotesPlaceholder')}
          rows={6}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(routes.adminBuddies(locale))}
          disabled={isSubmitting}
        >
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
