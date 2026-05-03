'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminProfileResponse } from '@peace-buddy/types'
import { getMyAdminProfile, updateMyAdminProfile } from './admin-profile'

export default function AdminProfilePage() {
  const { ready } = useAdminGuard()
  const t = useTranslations('adminProfile')
  const [profile, setProfile] = useState<AdminProfileResponse | null>(null)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!ready) return
    getMyAdminProfile().then((result) => {
      if (result.ok && result.data) {
        setProfile(result.data)
        setName(result.data.name)
      }
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    const result = await updateMyAdminProfile(name)
    setSaving(false)
    if (result.ok) {
      setProfile(result.data)
      setName(result.data.name)
      setEditing(false)
      setSaved(true)
    } else {
      const errorMessages: Record<string, string> = {
        not_found: t('error.notFound'),
        invalid_request: t('error.invalid_request'),
        network: t('error.network'),
      }
      setSaveError(errorMessages[result.error.code] ?? t('error.unknown'))
    }
  }

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {saved && !editing && (
        <p className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{t('saveSuccess')}</p>
      )}

      {saveError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{saveError}</p>
      )}

      <div className="max-w-sm">
        {editing ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('name')}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                disabled={saving}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{t('save')}</Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setEditing(false)
                  setName(profile?.name ?? '')
                  setSaveError(null)
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('name')}</p>
              <p className="font-medium">{profile?.name ?? '—'}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setEditing(true); setSaved(false) }}>
              {t('edit')}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
