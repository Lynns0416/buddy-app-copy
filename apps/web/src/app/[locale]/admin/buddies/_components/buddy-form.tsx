'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import type { AdminBuddyResponse, BuddyTier, UpdateAdminBuddyProfile } from '@peace-buddy/types'
import { BuddyTierSchema, BuddyStatusSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { routes } from '@/lib/routes'
import { updateBuddy, updateBuddyStatus } from '../admin.buddy'
import { PromoteTierModal } from './promote-tier-modal'

const TIER_NONE = '__none__'

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
  const [showPromoteModal, setShowPromoteModal] = useState(false)

  const isTrainee = buddy.status === BuddyStatusSchema.enum.trainee
  const backRoute = isTrainee ? routes.adminTrainees(locale) : routes.adminBuddies(locale)

  async function doPromote() {
    setIsSubmitting(true)
    setError(null)
    const result = await updateBuddyStatus(buddy.id, BuddyStatusSchema.enum.active)
    setIsSubmitting(false)
    if (result.ok) {
      router.push(routes.adminTrainees(locale))
    } else {
      setError(t('error.unknown'))
    }
  }

  async function doSave() {
    setIsSubmitting(true)
    setError(null)

    const data: UpdateAdminBuddyProfile = {}
    if (!isTrainee && selectedTier !== buddy.tier) {
      data.tier = selectedTier || null
    }
    if (notes !== buddy.internalNotes) {
      data.internalNotes = notes || null
    }

    const result = await updateBuddy(buddy.id, data)
    setIsSubmitting(false)
    if (result.ok) {
      router.push(backRoute)
    } else {
      setError(t('error.unknown'))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await doSave()
  }

  return (
    <>
      <PromoteTierModal
        open={showPromoteModal}
        buddyName={buddy.displayName}
        loading={isSubmitting}
        onConfirm={() => { setShowPromoteModal(false); doPromote() }}
        onCancel={() => setShowPromoteModal(false)}
      />
      <form onSubmit={onSubmit} className="space-y-6">
        {error && (
          <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!isTrainee && (
          <div>
            <Label htmlFor="tier">{t('tier')}</Label>
            <Select
              value={selectedTier || TIER_NONE}
              onValueChange={(val) => setSelectedTier(val === TIER_NONE ? '' : val as BuddyTier)}
            >
              <SelectTrigger id="tier">
                <SelectValue placeholder={t('tierPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TIER_NONE}>{t('tierNone')}</SelectItem>
                {BuddyTierSchema.options.map((tier: BuddyTier) => (
                  <SelectItem key={tier} value={tier}>
                    {t(`tier${tier.charAt(0).toUpperCase() + tier.slice(1)}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
          {isTrainee && (
            <Button
              type="button"
              onClick={() => setShowPromoteModal(true)}
              disabled={isSubmitting}
            >
              {t('promoteButton')}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {t('save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(backRoute)}
            disabled={isSubmitting}
          >
            {t('cancel')}
          </Button>
        </div>
      </form>
    </>
  )
}
