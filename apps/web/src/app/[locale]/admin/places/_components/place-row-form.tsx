'use client'

import { useId, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type PlaceRowFormValues = { nameJa: string; nameEn: string; sortOrder: number; active: boolean }

type Props = {
  initial?: PlaceRowFormValues
  onSubmit: (values: PlaceRowFormValues) => Promise<void>
  onCancel: () => void
}

// Shared shape for both Place and Spot rows — same four fields either way.
export function PlaceRowForm({ initial, onSubmit, onCancel }: Props) {
  const t = useTranslations('adminPlaces')
  const uid = useId()
  const [nameJa, setNameJa] = useState(initial?.nameJa ?? '')
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '')
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 1)
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ nameJa, nameEn, sortOrder, active })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('actionError'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-nameJa`}>{t('nameJa')}</Label>
        <Input id={`${uid}-nameJa`} value={nameJa} onChange={(e) => setNameJa(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-nameEn`}>{t('nameEn')}</Label>
        <Input id={`${uid}-nameEn`} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
      </div>
      <div className="flex w-24 flex-col gap-1">
        <Label htmlFor={`${uid}-sortOrder`}>{t('sortOrder')}</Label>
        <Input
          id={`${uid}-sortOrder`}
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <input
          id={`${uid}-active`}
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <Label htmlFor={`${uid}-active`} className="font-normal">{t('active')}</Label>
      </div>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 pb-0.5">
        <Button type="submit" size="sm" disabled={saving}>{t('save')}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  )
}
