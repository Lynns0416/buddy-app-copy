'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

interface CompleteTourModalProps {
  open: boolean
  confirmedBuddies: string[]
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function CompleteTourModal({
  open,
  confirmedBuddies,
  loading,
  onConfirm,
  onCancel,
}: CompleteTourModalProps) {
  const t = useTranslations('adminTours')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{t('completeTourModal.title')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('completeTourModal.message')}</p>
        {confirmedBuddies.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">{t('completeTourModal.noBuddies')}</p>
        ) : (
          <ul className="mb-4 space-y-1">
            {confirmedBuddies.map((name) => (
              <li key={name} className="text-sm font-medium">
                {name}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button disabled={loading} onClick={onConfirm}>
            {t('completeTourModal.confirm')}
          </Button>
          <Button variant="outline" disabled={loading} onClick={onCancel}>
            {t('completeTourModal.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
