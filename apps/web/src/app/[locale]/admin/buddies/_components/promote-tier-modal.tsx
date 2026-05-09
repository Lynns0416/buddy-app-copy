'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

interface PromoteTierModalProps {
  open: boolean
  buddyName: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PromoteTierModal({
  open,
  buddyName,
  loading,
  onConfirm,
  onCancel,
}: PromoteTierModalProps) {
  const t = useTranslations('adminBuddies')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{t('promoteTierModal.title')}</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {t('promoteTierModal.message', { name: buddyName })}
        </p>
        <div className="flex gap-2">
          <Button disabled={loading} onClick={onConfirm}>
            {t('promoteTierModal.confirm')}
          </Button>
          <Button variant="outline" disabled={loading} onClick={onCancel}>
            {t('promoteTierModal.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
