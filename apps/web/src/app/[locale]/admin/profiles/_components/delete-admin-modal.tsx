'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

interface DeleteAdminModalProps {
  open: boolean
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteAdminModal({ open, loading, onConfirm, onCancel }: DeleteAdminModalProps) {
  const t = useTranslations('adminProfiles')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{t('delete')}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{t('confirmDelete')}</p>
        <div className="flex gap-2">
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            {t('delete')}
          </Button>
          <Button variant="outline" disabled={loading} onClick={onCancel}>
            {t('cancelDelete')}
          </Button>
        </div>
      </div>
    </div>
  )
}
